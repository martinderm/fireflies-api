# Prozesse — Lesevertrag

Inputs: konkreter Skript-Aufruf, zugehörige Objektkarte und belegte Quellmodule. Keine Kuratierungspläne laden.

| Bewegung | Karte |
| :--- | :--- |
| api-call | [api-call](api-call.md) |
| meeting-sync | [meeting-sync](meeting-sync.md) |

`local-relocate` wurde mit dem Adapter-Schreibpfad entfernt; lokale Meeting-Dateien verschiebt nur der kanonische Writer.

Process: Input, tatsächliche Schritte und Output der gewählten Karte gegen Quelle prüfen.
Outputs: verifizierter Ablauf und direkter Änderungsscope.
Human Check: Jeder Schritt ist mit einem aktiven Modul belegt; Secret-Zugriff bleibt im Client-Objekt beschrieben und wird hier nicht dupliziert.