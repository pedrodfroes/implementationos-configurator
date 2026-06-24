# SAP ECC extraction for the APS model

This is the source-side counterpart to the in-app dataset generator. Where the
generator *invents* a representative dataset, these RFCs *extract* the real one
from an SAP ECC system (PP or PP-PI). Each target entity in the scheduling model
maps to standard SAP tables, with a standard BAPI where one fits and a custom
RFC-enabled function module (`ZAPS_*`, in `ZAPS_EXTRACT.abap`) where it doesn't.

> ⚠️ **Untested reference scaffolding.** This is hand-written ABAP that has not
> run against a system. Treat it as a starting point: adapt field lists,
> add the customer's Z-fields, respect MRP areas / special procurement, and
> have a SAP developer review authorizations and performance (package size,
> `FOR ALL ENTRIES`, secondary indexes) before productive use.

## Entity → SAP source map

| APS entity (generator table) | SAP ECC source tables | Standard BAPI / FM | Custom RFC |
|---|---|---|---|
| `org_hierarchy` (Plant→SLoc→Bin) | `T001W`, `T001L`, `LAGP` (WM bins) | — | `ZAPS_GET_PLANTS` |
| `departments` (work areas) | `CRHD`-`VERWE`, `T024D` (MRP ctrl), cost center `CSKT` | — | (in `ZAPS_GET_WORK_CENTERS`) |
| `resources` (work centers) | `CRHD`, `CRCA`, `KAKO`, `CRTX` | `CR_WORKSTATION_READ` | `ZAPS_GET_WORK_CENTERS` |
| `skills` / secondary resources | `CRHD` (labor WCs) or HR `HRP1000/1001`, qualifications `HRP1001`/`PB30` | `BAPI_QUALIF_*` | `ZAPS_GET_CAPACITIES` (people) |
| `calendars` / `shifts` | Factory calendar `TFACS/TFACD`; capacity `KAKO`, intervals `TC37A` (shift defs), `KAPA` | `FACTORYCALENDAR_GET`, `CR_CAPACITY_VARIANT_READ` | `ZAPS_GET_FACTORY_CALENDAR` |
| `materials` / `Items` | `MARA`, `MARC`, `MARD`, `MAKT`, `MBEW` (cost) | `BAPI_MATERIAL_GET_DETAIL` / `_GETLIST` | `ZAPS_GET_MATERIALS` |
| `bom_templates` | `STKO`, `STPO`, `MAST` | `CS_BOM_EXPL_MAT_V2` (explosion), `CSAP_MAT_BOM_READ` | `ZAPS_GET_BOM` |
| `routing_templates` | `PLKO`, `PLAS`, `PLPO`, `MAPL`, `PLFL`; PP-PI recipes `PLPOD` | `BAPI_ROUTING_GETLIST`, `CARO`/`CA_ROUTING_READ` | `ZAPS_GET_ROUTINGS` |
| production version (BOM↔routing) | `MKAL` | `CM_FV_PROD_VERS_GET` | (read `MKAL`) |
| changeover **attribute matrices** | Classification: `KLAH`, `KSML`, `CABN`, `CAWN`, `CAWNT`, `AUSP`; setup groups `PLPO-SLWID`/`SLWBEZ` | `CLAF_CLASSIFICATION_OF_OBJECTS`, `BAPI_OBJCL_GETDETAIL` | `ZAPS_GET_CHANGEOVER_ATTR` |
| `demand_orders` / production orders | `AUFK`, `AFKO`, `AFPO`, `AFVC`, `AFVV`, `AFRU`; planned `PLAF` | `BAPI_PRODORD_GET_LIST` + `_GET_DETAIL` | `ZAPS_GET_PROD_ORDERS` |
| requirements / demand | `MDPSX` (via reqs read), `VBBE`, `RESB` | `MD_STOCK_REQUIREMENTS_LIST_API` | `ZAPS_GET_REQUIREMENTS` |
| sales orders | `VBAK`, `VBAP`, `VBEP` (schedule lines) | `BAPI_SALESORDER_GETLIST` / `GETSTATUS` | — (use BAPI) |
| inventory / stock + shelf life | `MARD`, `MCHB`, `MCH1` (`VFDAT`/`HSDAT`) | `BAPI_MATERIAL_STOCK_REQ_LIST` | — (use BAPI) |
| purchasing lead time | `EINA`, `EINE`, `MARC-PLIFZ` | `BAPI_INFORECORD_GETLIST` | (read `EINE`) |

## Why custom RFCs (not only BAPIs)

The standard PP BAPIs return *one object at a time* (one material, one routing,
one order detail) and were not built for bulk extraction. For APS staging you
want set-based reads with a plant/date selection that return flat, RFC-typed
tables in one round trip. The `ZAPS_*` modules do exactly that; they fall back
to the standard explosion FMs (`CS_BOM_EXPL_MAT_V2`) only where the logic is
non-trivial to reproduce.

## DDIC structures to create

Each `TABLES` parameter references a flat DDIC structure (RFC requires
dictionary types — local types are not allowed across the RFC boundary). Create
these transparent structures in SE11 (field lists are in the header comment of
each function module). Suggested names: `ZAPS_S_PLANT`, `ZAPS_S_WORKCENTER`,
`ZAPS_S_CALENDAR`, `ZAPS_S_MATERIAL`, `ZAPS_S_BOM`, `ZAPS_S_ROUTING`,
`ZAPS_S_CHANGEOVER`, `ZAPS_S_PRODORDER`, `ZAPS_S_REQUIREMENT`.

## Run order

1. `ZAPS_GET_PLANTS` → plants/locations (the org spine).
2. `ZAPS_GET_WORK_CENTERS` + `ZAPS_GET_FACTORY_CALENDAR` → capacity model.
3. `ZAPS_GET_MATERIALS` → item master.
4. `ZAPS_GET_BOM` + `ZAPS_GET_ROUTINGS` → product structure (per material/plant).
5. `ZAPS_GET_CHANGEOVER_ATTR` → the attribute changeover matrices.
6. `ZAPS_GET_PROD_ORDERS` + `ZAPS_GET_REQUIREMENTS` → the work / demand.

The result lands in the same shape the generator emits, so it feeds the generic,
Opcenter, or PlanetTogether projections unchanged.
