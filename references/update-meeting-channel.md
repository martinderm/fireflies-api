# Fireflies Mutation: Update Meeting Channel

Stand: 2026-04-30

## Zweck

Kurze lokale Referenz zur Mutation `updateMeetingChannel`, damit Channel-Zuordnungen später nicht aus dem Bauch umgesetzt werden.

## Kernaussagen

- Mutation: `updateMeetingChannel(input: UpdateMeetingChannelInput!)`
- Zweck: Channel-Zuordnung für 1 bis 5 Meetings/Transcripts in einem Call setzen
- Eingabe:
  - `transcript_ids: [String!]!`
  - `channel_id: ID!`
- Ein Meeting kann laut Doku nur **einem** Channel gleichzeitig zugeordnet sein.
- Die Mutation ersetzt die bisherige Channel-Zuordnung.
- Berechtigung: Admin im Team oder Eigentümer:in des Meetings
- Semantik: all-or-nothing; wenn ein Transcript fehlschlägt, wird keines aktualisiert

## Minimales Beispiel

```graphql
mutation UpdateMeetingChannel($input: UpdateMeetingChannelInput!) {
  updateMeetingChannel(input: $input) {
    id
    title
    channels {
      id
    }
  }
}
```

Beispiel-Variablen:

```json
{
  "input": {
    "transcript_ids": ["transcript_id_1"],
    "channel_id": "channel_id"
  }
}
```

## Typische Fehlerbilder

- `require_elevated_privilege`
  - keine ausreichenden Rechte
- `object_not_found (transcript)`
  - Transcript nicht gefunden oder kein Zugriff
- `invalid_arguments`
  - leeres Array, mehr als 5 IDs, fehlende/ungültige `channel_id`

## Praktische Hinweise für diesen Skill

- Vor API-Write immer Channel-ID über `list-channels.mjs` verifizieren
- Bei lokaler Nachpflege klar zwischen
  - echter Fireflies-API-Änderung und
  - rein lokaler Meeting-Umsortierung in `memory/references/meetings/`
  unterscheiden
- Wenn der User explizit **keine API-Aktion** will, nur lokale Dateien und `meetings.json` anfassen

## Quellen

- Update Meeting Channel
  - URL: https://docs.fireflies.ai/graphql-api/mutation/update-meeting-channel.md
  - Gelesen: 2026-04-30
- UpdateMeetingChannelInput
  - URL: https://docs.fireflies.ai/schema/input/update-meeting-channel-input.md
  - Gelesen: 2026-04-30
