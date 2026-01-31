# School & College First — Resolve

This product is built **first for schools and colleges**, then extended to offices, factories, and public transport. The current schema and UI use education-friendly terminology and defaults.

---

## School/College Terminology

| Concept | In product | Examples |
|--------|------------|----------|
| **Locations** | Campus → Building → Floor → Room | Main Campus, Block A, Floor 2, Room 201 (Classroom), Lab 3 |
| **Departments** | Academic / admin units | Science, Computer Lab, Library, Administration, Sports |
| **Assets** | Equipment & furniture | Projector, Whiteboard, Desktop, AC, Furniture, Lab Equipment, Printer |
| **Users** | Roles | Admin (office), Staff (teachers/admin), Technician (maintenance) |
| **Issues** | Reported by staff/students | "Projector not turning on", "AC leaking" |

---

## Why Schools/Colleges First

1. **Clear hierarchy** — Campus → Building → Room maps naturally to institutions.
2. **Controlled scale** — One campus, limited locations; easier to onboard.
3. **QR on every room/asset** — Students and staff scan to see asset info or report issues without hunting for the right person.
4. **Accountability** — Who reported what, who fixed it, audit trail for management.
5. **Future expansion** — Same data model can later support:
   - **Offices:** Building → Floor → Department → Desk/Zone
   - **Factories:** Plant → Line → Machine
   - **Public transport:** Depot → Vehicle → Component

---

## Extending to Other Sectors Later

When adding offices, factories, or transport:

1. **Organization type** — Add `organizationType: 'school' | 'college' | 'office' | 'factory' | 'transport'` to a top-level config or tenant model.
2. **Location types** — Already generic (`campus`, `building`, `floor`, `room`). For factories: `plant`, `line`, `zone`; for transport: `depot`, `vehicle`.
3. **Categories** — Asset categories are free text; add sector-specific presets (e.g. "Machine", "Fleet") in the UI.
4. **Roles** — Same Admin / Staff / Technician can map to Office Manager, Floor Supervisor, Maintenance in other sectors.

No need to change the core schema now; the current design is flexible enough to extend.
