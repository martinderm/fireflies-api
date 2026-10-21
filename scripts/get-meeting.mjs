import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  firefliesGraphQL,
  loadSettingsJson,
  printError,
  printJson,
  resolveWorkspaceRoot
} from './_fireflies-client.mjs';
import {
  buildGetMeetingQuery,
  parseGetMeetingArgs,
  parseSpeakerMap,
  renderTranscriptMarkdown,
  resolveGetMeetingMode,
  validateGetMeetingArgs
} from './_fireflies-meetings.mjs';
import { buildMeetingRecord, validateMeetingRecord } from './_meeting-record.mjs';
import { relativeWorkspacePath } from './_path-helpers.mjs';
import { requireWorkspaceLease } from './_workspace-lease.mjs';

function exportError(code, guidance = null) {
  const error = new Error(guidance ? `${code}: ${guidance}` : code);
  error.exitCode = 2;
  return error;
}

function normalizeForComparison(value) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isInside(base, candidate) {
  const relative = path.relative(
    normalizeForComparison(base),
    normalizeForComparison(candidate)
  );
  return relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

function realExisting(target, code) {
  try {
    return fs.realpathSync.native(target);
  } catch {
    throw exportError(code);
  }
}

function pathEntryExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

export function resolveRecordExportTarget({ workspaceRoot, output }) {
  const root = realExisting(path.resolve(workspaceRoot), 'workspace_root_missing');
  const dataDir = realExisting(
    path.join(root, 'data'),
    'workspace_data_zone_missing: select the correct --workspace or create its data/ zone'
  );
  if (!fs.statSync(dataDir).isDirectory()) {
    throw exportError('workspace_data_zone_not_directory: data/ must be a directory');
  }
  if (dataDir === root || !isInside(root, dataDir)) {
    throw exportError('workspace_data_zone_escapes_workspace: data/ must resolve inside the selected workspace');
  }
  if (typeof output !== 'string' || output.trim() === '') {
    throw exportError('output_path_missing');
  }

  const resolved = path.isAbsolute(output)
    ? path.resolve(output)
    : path.resolve(root, output);
  if (!isInside(dataDir, resolved)) {
    throw exportError('output_outside_workspace_data_zone: choose a path under <workspace>/data/');
  }

  const realParent = realExisting(
    path.dirname(resolved),
    'output_parent_missing: create the parent directory under data/ first'
  );
  if (!fs.statSync(realParent).isDirectory()) {
    throw exportError('output_parent_not_directory: the output parent must be a directory');
  }
  if (realParent !== dataDir && !isInside(dataDir, realParent)) {
    throw exportError('output_path_escapes_workspace_data_zone: links may not leave data/');
  }

  const absolutePath = path.join(realParent, path.basename(resolved));
  if (!isInside(dataDir, absolutePath)) {
    throw exportError('output_path_escapes_workspace_data_zone: links may not leave data/');
  }
  if (pathEntryExists(absolutePath)) {
    throw exportError('output_exists_no_clobber: choose a new export file name');
  }

  return {
    absolutePath,
    relativePath: relativeWorkspacePath(root, absolutePath),
    dataDir
  };
}

export function stageRecordExport({ absolutePath, record }) {
  validateMeetingRecord(record);
  const content = `${JSON.stringify(record, null, 2)}\n`;
  const directory = path.dirname(absolutePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`
  );
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', flag: 'wx' });
  return { tempPath, absolutePath, content };
}

export function discardStagedRecordExport(staged) {
  if (!staged?.tempPath) return;
  try {
    fs.unlinkSync(staged.tempPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function publishStagedRecordExport(staged) {
  try {
    fs.copyFileSync(staged.tempPath, staged.absolutePath, fs.constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw exportError('output_exists_no_clobber: choose a new export file name');
    }
    throw error;
  }
  discardStagedRecordExport(staged);
}

export async function exportMeetingRecord({
  workspaceRoot,
  output,
  leaseId,
  workspaceLockRoot,
  python,
  fetchMeeting,
  buildRecord = (meeting) => buildMeetingRecord(meeting),
  afterStage = null,
  leaseCheck = requireWorkspaceLease,
  targetResolver = resolveRecordExportTarget,
  env = process.env
}) {
  if (typeof fetchMeeting !== 'function') {
    throw exportError('fetch_meeting_required');
  }

  const leaseArgs = {
    python,
    workspaceLockRoot,
    workspace: workspaceRoot,
    leaseId,
    env
  };

  // Path and zone validation stay before credentials/API.
  targetResolver({ workspaceRoot, output });

  // The canonical guard is invoked in place; no local ownership rules.
  await leaseCheck(leaseArgs);

  const meeting = await fetchMeeting();
  if (meeting === null || typeof meeting !== 'object' || Array.isArray(meeting)) {
    throw exportError('meeting_payload_missing');
  }

  const record = buildRecord(meeting);

  // Revalidate path and lease before any staging write.
  const target = targetResolver({ workspaceRoot, output });
  await leaseCheck(leaseArgs);

  const staged = stageRecordExport({ absolutePath: target.absolutePath, record });
  try {
    if (afterStage) await afterStage();

    // Path and lease are revalidated immediately before create-only publication.
    const finalTarget = targetResolver({ workspaceRoot, output });
    if (finalTarget.absolutePath !== target.absolutePath) {
      throw exportError('output_path_changed_before_publish');
    }
    await leaseCheck(leaseArgs);
    publishStagedRecordExport(staged);

    return {
      record,
      output: finalTarget.relativePath,
      absolutePath: finalTarget.absolutePath
    };
  } finally {
    discardStagedRecordExport(staged);
  }
}

function resolveAccountRef(settings, env = process.env) {
  return env.FIREFLIES_ACCOUNT
    || settings?.['fireflies-api']?.account
    || settings?.fireflies?.account
    || null;
}

async function main() {
  let args;
  let speakerMap;
  try {
    args = validateGetMeetingArgs(parseGetMeetingArgs(process.argv.slice(2)));
    speakerMap = args.speakerMap ? parseSpeakerMap(args.speakerMap) : undefined;
  } catch (error) {
    printError(error);
    process.exitCode = 2;
    return;
  }

  try {
    // A record export always needs the full artifact set; a minimal/sentences-only
    // query cannot produce a valid record with summary or transcript evidence.
    const mode = args.output ? 'full' : resolveGetMeetingMode(args);
    const workspaceRoot = args.output
      ? (args.workspace ? path.resolve(args.workspace) : resolveWorkspaceRoot())
      : null;

    if (args.output) {
      const exported = await exportMeetingRecord({
        workspaceRoot,
        output: args.output,
        leaseId: args.leaseId,
        workspaceLockRoot: args.workspaceLockRoot,
        python: args.python,
        fetchMeeting: async () => {
          const data = await firefliesGraphQL({
            query: buildGetMeetingQuery(mode),
            variables: { transcriptId: args.transcriptId }
          });
          return data?.transcript ?? null;
        },
        buildRecord: (meeting) => buildMeetingRecord(meeting, {
          accountRef: resolveAccountRef(loadSettingsJson())
        })
      });
      printJson({
        ok: true,
        format: 'record',
        record_schema: exported.record.schema,
        meeting_id: exported.record.meeting_id,
        output: exported.output
      });
      return;
    }

    const query = buildGetMeetingQuery(mode);
    const data = await firefliesGraphQL({
      query,
      variables: { transcriptId: args.transcriptId }
    });
    const meeting = data?.transcript ?? null;
    const result = args.format === 'markdown'
      ? renderTranscriptMarkdown(meeting, { speakerMap, withFrontmatter: args.withFrontmatter })
      : JSON.stringify({ ok: true, mode, meeting }, null, 2);
    process.stdout.write(`${result}\n`);
  } catch (error) {
    printError(error);
    process.exitCode = error?.exitCode ?? 1;
  }
}

const isDirectRun = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main();
}
