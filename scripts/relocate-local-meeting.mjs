import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..', '..');
const meetingsRoot = path.join(workspaceRoot, 'memory', 'references', 'meetings');
const meetingsJsonPath = path.join(meetingsRoot, 'meetings.json');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--meeting-id' && next) {
      args.meetingId = next;
      i += 1;
    } else if (arg === '--from-slug' && next) {
      args.fromSlug = next;
      i += 1;
    } else if (arg === '--to-slug' && next) {
      args.toSlug = next;
      i += 1;
    } else if (arg === '--to-title' && next) {
      args.toTitle = next;
      i += 1;
    } else if (arg === '--topic-slug' && next) {
      args.topicSlug = next;
      i += 1;
    } else if (arg === '--resolved-at' && next) {
      args.resolvedAt = next;
      i += 1;
    }
  }
  return args;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function yamlValue(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return JSON.stringify(String(value));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceOrInsertYamlField(text, key, value) {
  const line = `${key}: ${yamlValue(value)}`;
  const pattern = new RegExp(`^${escapeRegex(key)}:.*$`, 'm');
  if (pattern.test(text)) {
    return text.replace(pattern, line);
  }

  const fmEnd = text.indexOf('\n---\n', 4);
  if (fmEnd === -1) return text;
  return `${text.slice(0, fmEnd)}\n${line}${text.slice(fmEnd)}`;
}

function updateFrontmatter(text, fields) {
  let next = String(text);
  for (const [key, value] of Object.entries(fields)) {
    next = replaceOrInsertYamlField(next, key, value);
  }
  return next;
}

function replaceAll(text, replacements) {
  let next = String(text);
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function moveFile(fromPath, toPath) {
  ensureDir(path.dirname(toPath));
  if (!fs.existsSync(fromPath)) {
    throw new Error(`source_file_missing:${fromPath}`);
  }
  if (fs.existsSync(toPath)) {
    fs.unlinkSync(toPath);
  }
  fs.renameSync(fromPath, toPath);
}

const args = parseArgs(process.argv.slice(2));

if (!args.meetingId || !args.fromSlug || !args.toSlug || !args.toTitle || !args.topicSlug || !args.resolvedAt) {
  console.error(JSON.stringify({ ok: false, error: 'usage: node relocate-local-meeting.mjs --meeting-id <id> --from-slug <slug> --to-slug <slug> --to-title <title> --topic-slug <slug> --resolved-at <iso>' }, null, 2));
  process.exit(2);
}

const state = readJson(meetingsJsonPath);
const meetings = Array.isArray(state.meetings) ? state.meetings : [];
const meeting = meetings.find((item) => item.meeting_id === args.meetingId);

if (!meeting) {
  console.error(JSON.stringify({ ok: false, error: 'meeting_not_found', meeting_id: args.meetingId }, null, 2));
  process.exit(1);
}

const summaryFromRel = meeting.summary_path;
const transcriptFromRel = meeting.transcript_path;
const summaryToRel = summaryFromRel.replace(`/references/meetings/${args.fromSlug}/`, `/references/meetings/${args.toSlug}/`);
const transcriptToRel = transcriptFromRel.replace(`/references/meetings/${args.fromSlug}/`, `/references/meetings/${args.toSlug}/`);
const summaryFromPath = path.join(workspaceRoot, summaryFromRel);
const transcriptFromPath = path.join(workspaceRoot, transcriptFromRel);
const summaryToPath = path.join(workspaceRoot, summaryToRel);
const transcriptToPath = path.join(workspaceRoot, transcriptToRel);

const summaryOriginal = fs.readFileSync(summaryFromPath, 'utf8');
const transcriptOriginal = fs.readFileSync(transcriptFromPath, 'utf8');

const channelId = state.channel_mappings?.[args.toSlug]?.channel_id ?? null;
const classificationNotesArray = ['chat-review-topic:netzwerke', 'subtopic:eucen'];
const classificationBasis = ['channel:boku', 'title:6th-eucen-global-seminar', 'summary:eucen-network-lifelong-learning-funding'];
const llmSummary = 'Lokal nach `boku` verschoben und als Topic `netzwerke` klassifiziert. Inhaltlich klarer EUCEN-/Netzwerkbezug mit Fokus auf Finanzierung von Lifelong Learning; fachlich dem Subtopic EUCEN zuzuordnen.';
const classificationNotesInline = classificationNotesArray.join('; ');

const sharedPathReplacements = [
  [summaryFromRel.replace(/\\/g, '/'), summaryToRel.replace(/\\/g, '/')],
  [transcriptFromRel.replace(/\\/g, '/'), transcriptToRel.replace(/\\/g, '/')],
  ['- Channel: -', `- Channel: ${args.toTitle}`],
  [`- Channel: ${args.fromSlug}`, `- Channel: ${args.toTitle}`],
  ['- Channels: -', `- Channels: ${args.toTitle}`],
  ['- Classification Notes: chat-review-classification-pending', `- Classification Notes: ${classificationNotesInline}`]
];

const summaryUpdated = updateFrontmatter(
  replaceAll(summaryOriginal, sharedPathReplacements),
  {
    channel: args.toTitle,
    channel_slug: args.toSlug,
    channel_id: channelId,
    channels: [args.toTitle],
    topic_slug: args.topicSlug,
    classification_status: 'mapped',
    classification_confidence: 'high',
    classification_notes: classificationNotesArray,
    classification_basis: classificationBasis,
    review_recommended: false,
    review_reason: null,
    llm_review_status: 'resolved',
    summary_path: summaryToRel.replace(/\\/g, '/'),
    transcript_path: transcriptToRel.replace(/\\/g, '/'),
    server_change_status: meeting.server_change_status ?? 'unchanged',
    server_changed_since_last_sync: meeting.server_changed_since_last_sync ?? false,
    first_synced_at: meeting.first_synced_at ?? null,
    last_synced_at: meeting.last_synced_at ?? null
  }
);

const transcriptUpdated = updateFrontmatter(
  replaceAll(transcriptOriginal, sharedPathReplacements),
  {
    channel: args.toTitle,
    channel_slug: args.toSlug,
    channel_id: channelId,
    channels: [args.toTitle],
    topic_slug: args.topicSlug,
    classification_status: 'mapped',
    classification_confidence: 'high',
    classification_notes: classificationNotesArray,
    classification_basis: classificationBasis,
    review_recommended: false,
    review_reason: null,
    llm_review_status: 'resolved',
    summary_path: summaryToRel.replace(/\\/g, '/'),
    transcript_path: transcriptToRel.replace(/\\/g, '/'),
    server_change_status: meeting.server_change_status ?? 'unchanged',
    server_changed_since_last_sync: meeting.server_changed_since_last_sync ?? false,
    first_synced_at: meeting.first_synced_at ?? null,
    last_synced_at: meeting.last_synced_at ?? null
  }
);

fs.writeFileSync(summaryFromPath, summaryUpdated, 'utf8');
fs.writeFileSync(transcriptFromPath, transcriptUpdated, 'utf8');
moveFile(summaryFromPath, summaryToPath);
moveFile(transcriptFromPath, transcriptToPath);

meeting.channel = args.toTitle;
meeting.channel_slug = args.toSlug;
meeting.channel_id = channelId;
meeting.channels = [args.toTitle];
meeting.topic_slug = args.topicSlug;
meeting.topic_slugs = [args.topicSlug];
meeting.classification_status = 'mapped';
meeting.classification_confidence = 'high';
meeting.classification_notes = classificationNotesArray;
meeting.classification_basis = classificationBasis;
meeting.review_recommended = false;
meeting.review_reason = null;
meeting.llm_review_status = 'resolved';
meeting.llm_review_summary = llmSummary;
meeting.resolved_by = 'agent-chat';
meeting.resolved_at = args.resolvedAt;
meeting.summary_path = summaryToRel.replace(/\\/g, '/');
meeting.transcript_path = transcriptToRel.replace(/\\/g, '/');

if (meeting.review_input && typeof meeting.review_input === 'object') {
  meeting.review_input.channel = args.toTitle;
  meeting.review_input.channel_slug = args.toSlug;
  meeting.review_input.routing_mode = state.channel_mappings?.[args.toSlug]?.routing_mode ?? 'unmapped';
  meeting.review_input.topic_slug = args.topicSlug;
  meeting.review_input.classification_status = 'mapped';
  meeting.review_input.classification_confidence = 'high';
  meeting.review_input.classification_basis = classificationBasis;
  meeting.review_input.review_recommended = false;
  meeting.review_input.review_reason = null;
}

writeJson(meetingsJsonPath, state);

console.log(JSON.stringify({
  ok: true,
  meeting_id: meeting.meeting_id,
  title: meeting.title,
  from: {
    channel_slug: args.fromSlug,
    summary_path: summaryFromRel,
    transcript_path: transcriptFromRel
  },
  to: {
    channel: meeting.channel,
    channel_slug: meeting.channel_slug,
    channel_id: meeting.channel_id,
    topic_slug: meeting.topic_slug,
    summary_path: meeting.summary_path,
    transcript_path: meeting.transcript_path
  }
}, null, 2));
