*&---------------------------------------------------------------------*
*& Function group  ZAPS_EXTRACT
*& APS data extraction from SAP ECC (PP / PP-PI)
*&
*& Each function module below must be flagged "Remote-Enabled Module"
*& (SE37 -> Attributes -> Processing Type) and assigned to the
*& destination's authorization. The interface comment blocks match what
*& SE37 generates; create the ZAPS_S_* DDIC structures first (field
*& lists given per module).
*&
*& Conventions:
*&   - Selection by plant (IV_WERKS) plus an optional material range.
*&   - Set-based SELECTs (no SELECT-in-LOOP); FOR ALL ENTRIES guarded
*&     against empty driver tables.
*&   - Flat, RFC-typed return tables (TABLES parameters).
*&---------------------------------------------------------------------*

*"----------------------------------------------------------------------
*" ZAPS_GET_PLANTS  — org spine: plants + storage locations
*"   ZAPS_S_PLANT: WERKS, NAME1, COMPANY_CODE(BUKRS), COUNTRY(LAND1),
*"                 CALENDAR_ID(FABKL), LGORT, LGOBE
*"----------------------------------------------------------------------
FUNCTION zaps_get_plants.
*"  IMPORTING
*"     VALUE(IV_WERKS) TYPE WERKS_D OPTIONAL
*"  TABLES
*"     ET_PLANTS STRUCTURE ZAPS_S_PLANT
*"----------------------------------------------------------------------
  DATA: lr_werks TYPE RANGE OF werks_d.

  IF iv_werks IS NOT INITIAL.
    lr_werks = VALUE #( ( sign = 'I' option = 'EQ' low = iv_werks ) ).
  ENDIF.

  SELECT w~werks, w~name1, w~fabkl,
         t~bukrs, t~land1,
         l~lgort, l~lgobe
    FROM t001w AS w
    LEFT JOIN t001k AS k ON k~bwkey = w~werks          "valuation area = plant
    LEFT JOIN t001  AS t ON t~bukrs = k~bukrs
    LEFT JOIN t001l AS l ON l~werks = w~werks
    INTO CORRESPONDING FIELDS OF TABLE @et_plants
    WHERE w~werks IN @lr_werks.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_WORK_CENTERS — resources + their capacity + department
*"   ZAPS_S_WORKCENTER: WERKS, ARBPL(work center), KTEXT(text),
*"                      VERWE(usage/category), PLANGRUPPE/VERAN(dept),
*"                      KAPID, CAP_CATEGORY(KAPAR), AVAILABLE_CAP(KAPTPROZ),
*"                      NBR_INDIV_CAP(PLANR/ANZMA), EINHEIT, KOSTL,
*"                      RESOURCE_TYPE
*"----------------------------------------------------------------------
FUNCTION zaps_get_work_centers.
*"  IMPORTING
*"     VALUE(IV_WERKS) TYPE WERKS_D
*"  TABLES
*"     ET_WORKCENTERS STRUCTURE ZAPS_S_WORKCENTER
*"----------------------------------------------------------------------
  " CRHD = work center header, CRCA = capacity allocation,
  " KAKO = capacity header, CRTX = work center text.
  SELECT h~werks, h~arbpl, h~objid, h~verwe, h~veran AS dept, h~kostl,
         x~ktext,
         k~kapid, k~kapar AS cap_category, k~anzma AS nbr_indiv_cap,
         k~aznor AS available_cap, k~meins AS einheit
    FROM crhd AS h
    LEFT JOIN crtx AS x ON x~objty = h~objty AND x~objid = h~objid
                       AND x~spras = @sy-langu
    LEFT JOIN crca AS c ON c~objty = h~objty AND c~objid = h~objid
                       AND c~kapart = '001'              "machine capacity
    LEFT JOIN kako AS k ON k~kapid = c~kapid
    INTO CORRESPONDING FIELDS OF TABLE @et_workcenters
    WHERE h~werks = @iv_werks
      AND h~objty = 'A'.                                 "A = work center

  " Derive a coarse resource type from the work center category (VERWE):
  "   0007/0009 = labor/people, others = machine/processing.
  LOOP AT et_workcenters ASSIGNING FIELD-SYMBOL(<wc>).
    <wc>-resource_type = COND #( WHEN <wc>-verwe = '0007'
                                   OR <wc>-verwe = '0009' THEN 'labor-crews'
                                 ELSE 'processing-equipment' ).
  ENDLOOP.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_FACTORY_CALENDAR — working days + shift intervals
*"   ZAPS_S_CALENDAR: CALENDAR_ID(FABKL), DATE(DATUM), IS_WORKDAY(FLAG),
*"                    SHIFT_ID, SHIFT_START(BEGZT), SHIFT_END(ENDZT),
*"                    SHIFT_HOURS
*"----------------------------------------------------------------------
FUNCTION zaps_get_factory_calendar.
*"  IMPORTING
*"     VALUE(IV_FABKL)    TYPE WFCID
*"     VALUE(IV_DATE_FROM) TYPE DATUM
*"     VALUE(IV_DATE_TO)   TYPE DATUM
*"  TABLES
*"     ET_CALENDAR STRUCTURE ZAPS_S_CALENDAR
*"----------------------------------------------------------------------
  DATA: lv_date    TYPE datum,
        lv_workday TYPE c LENGTH 1.

  lv_date = iv_date_from.
  WHILE lv_date <= iv_date_to.
    CALL FUNCTION 'DATE_CONVERT_TO_FACTORYDATE'
      EXPORTING
        date                   = lv_date
        factory_calendar_id    = iv_fabkl
      IMPORTING
        workingday_indicator   = lv_workday        "'' = working, 'X' = off
      EXCEPTIONS
        calendar_buffer_not_loadable = 1
        date_after_range             = 2
        date_before_range            = 3
        date_invalid                 = 4
        factory_calendar_not_found   = 5
        OTHERS                       = 6.

    APPEND VALUE #( calendar_id = iv_fabkl
                    date        = lv_date
                    is_workday  = COND #( WHEN lv_workday = space THEN 'X' ELSE '' )
                  ) TO et_calendar.

    lv_date = lv_date + 1.
  ENDWHILE.

  " Shift definitions (grouping TC37A) — pattern of intervals per day.
  " Optional: read TC37A / TC37P for the customer's shift grouping and
  " stamp SHIFT_* on each working day. Left as a hook; populate from the
  " work center available-capacity intervals (KAPA) if shift-precise data
  " is required.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_MATERIALS — item master (header + plant + description + cost)
*"   ZAPS_S_MATERIAL: MATNR, MAKTX, MTART(type), MATKL(group), MEINS,
*"                    WERKS, DISMM(MRP type), DISPO(MRP ctrl), BESKZ(proc),
*"                    SOBSL(spec proc), DZEIT(in-house prod time),
*"                    PLIFZ(planned deliv), BSTMI(lot size), MAABC,
*"                    SOURCE(make/buy), STDPD(config), STPRS(std price)
*"----------------------------------------------------------------------
FUNCTION zaps_get_materials.
*"  IMPORTING
*"     VALUE(IV_WERKS) TYPE WERKS_D
*"  TABLES
*"     IT_MATNR_RANGE STRUCTURE ZAPS_S_MATNR_RANGE OPTIONAL
*"     ET_MATERIALS   STRUCTURE ZAPS_S_MATERIAL
*"----------------------------------------------------------------------
  DATA: lr_matnr TYPE RANGE OF matnr.

  lr_matnr = VALUE #( FOR r IN it_matnr_range
                      ( sign = r-sign option = r-option
                        low = r-low high = r-high ) ).

  SELECT a~matnr, a~mtart, a~matkl, a~meins, a~mstae,
         c~werks, c~dismm, c~dispo, c~beskz, c~sobsl,
         c~dzeit, c~plifz, c~bstmi, c~maabc, c~stdpd,
         t~maktx,
         b~stprs
    FROM mara AS a
    INNER JOIN marc AS c ON c~matnr = a~matnr
    LEFT  JOIN makt AS t ON t~matnr = a~matnr AND t~spras = @sy-langu
    LEFT  JOIN mbew AS b ON b~matnr = a~matnr AND b~bwkey = c~werks
    INTO CORRESPONDING FIELDS OF TABLE @et_materials
    WHERE c~werks = @iv_werks
      AND a~matnr IN @lr_matnr
      AND a~lvorm = @space.                              "not flagged for deletion

  " Make vs buy from procurement type (BESKZ): E = in-house, F = external.
  LOOP AT et_materials ASSIGNING FIELD-SYMBOL(<m>).
    <m>-source = COND #( WHEN <m>-beskz = 'F' THEN 'Purchase'
                         WHEN <m>-beskz = 'X' THEN 'Both'
                         ELSE 'Make' ).
  ENDLOOP.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_BOM — multi-level BOM explosion per material (wraps CS_BOM_*)
*"   ZAPS_S_BOM: PARENT_MATNR, WERKS, LEVEL(STUFE), COMPONENT(IDNRK),
*"               COMPONENT_TXT(OJTXP), QTY(MENGE), UOM(MEINS),
*"               ITEM_CATEGORY(POSTP), ITEM_NO(POSNR), PHANTOM(SANKA/SCHGT)
*"----------------------------------------------------------------------
FUNCTION zaps_get_bom.
*"  IMPORTING
*"     VALUE(IV_WERKS)   TYPE WERKS_D
*"     VALUE(IV_MATNR)   TYPE MATNR
*"     VALUE(IV_DATUV)   TYPE DATUV DEFAULT SY-DATUM
*"     VALUE(IV_EMENG)   TYPE BASMN DEFAULT 1
*"  TABLES
*"     ET_BOM STRUCTURE ZAPS_S_BOM
*"----------------------------------------------------------------------
  DATA: lt_stb  TYPE TABLE OF stpox,
        lt_matcat TYPE TABLE OF cscmat.

  CALL FUNCTION 'CS_BOM_EXPL_MAT_V2'
    EXPORTING
      capid                 = 'PP01'        "BOM application (PP)
      datuv                 = iv_datuv
      emeng                 = iv_emeng
      mehrs                 = 'X'           "multi-level explosion
      mtnrv                 = iv_matnr
      werks                 = iv_werks
      stlal                 = '01'
    TABLES
      stb                   = lt_stb
      matcat                = lt_matcat
    EXCEPTIONS
      alt_not_found         = 1
      call_invalid          = 2
      material_not_found    = 3
      missing_authorization = 4
      no_bom_found          = 5
      no_plant_data         = 6
      no_suitable_bom_found = 7
      conversion_error      = 8
      OTHERS                = 9.

  IF sy-subrc <> 0.
    RETURN.
  ENDIF.

  et_bom = VALUE #( FOR s IN lt_stb
                    ( parent_matnr  = iv_matnr
                      werks         = iv_werks
                      level         = s-stufe
                      component     = s-idnrk
                      component_txt = s-ojtxp
                      qty           = s-menge
                      uom           = s-meins
                      item_category = s-postp
                      item_no       = s-posnr
                      phantom       = s-schgt ) ).
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_ROUTINGS — routing/recipe operations per material
*"   ZAPS_S_ROUTING: MATNR, WERKS, PLNNR, PLNAL(group counter),
*"                   OP_NO(VORNR), OP_TXT(LTXA1), ARBPL(work center),
*"                   STEUS(control key), SETUP_TIME(VGW01), MACHINE_TIME(VGW02),
*"                   LABOR_TIME(VGW03), BASE_QTY(BMSCH), TIME_UOM(VGE01),
*"                   SETUP_GROUP(SLWID), SETUP_GROUP_KEY(SLWBEZ)
*"----------------------------------------------------------------------
FUNCTION zaps_get_routings.
*"  IMPORTING
*"     VALUE(IV_WERKS) TYPE WERKS_D
*"  TABLES
*"     IT_MATNR_RANGE STRUCTURE ZAPS_S_MATNR_RANGE OPTIONAL
*"     ET_ROUTINGS    STRUCTURE ZAPS_S_ROUTING
*"----------------------------------------------------------------------
  DATA: lr_matnr TYPE RANGE OF matnr.

  lr_matnr = VALUE #( FOR r IN it_matnr_range
                      ( sign = r-sign option = r-option low = r-low high = r-high ) ).

  " MAPL links material to routing group; PLAS sequences operations;
  " PLPO is the operation; PLKO the routing header. Read with validity.
  SELECT mapl~matnr, mapl~werks,
         k~plnnr, k~plnal,
         o~vornr AS op_no, o~ltxa1 AS op_txt, o~arbid,
         o~steus, o~vgw01 AS setup_time, o~vgw02 AS machine_time,
         o~vgw03 AS labor_time, o~bmsch AS base_qty, o~vge01 AS time_uom,
         o~slwid AS setup_group, o~slwbez AS setup_group_key
    FROM mapl
    INNER JOIN plko AS k ON k~plnty = mapl~plnty
                        AND k~plnnr = mapl~plnnr
    INNER JOIN plas AS s ON s~plnty = k~plnty
                        AND s~plnnr = k~plnnr
                        AND s~plnal = k~plnal
                        AND s~loekz = @space
    INNER JOIN plpo AS o ON o~plnty = s~plnty
                        AND o~plnnr = s~plnnr
                        AND o~plnkn = s~plnkn
                        AND o~loekz = @space
    INTO CORRESPONDING FIELDS OF TABLE @et_routings
    WHERE mapl~werks = @iv_werks
      AND mapl~matnr IN @lr_matnr
      AND mapl~loekz = @space
      AND mapl~plnty = 'N'.                               "N = routing (R = recipe)

  " Resolve the work center (ARBPL) from the operation's ARBID (CRHD).
  IF et_routings IS NOT INITIAL.
    SELECT objid, arbpl FROM crhd
      FOR ALL ENTRIES IN @et_routings
      WHERE objty = 'A' AND objid = @et_routings-arbid
      INTO TABLE @DATA(lt_wc).
    LOOP AT et_routings ASSIGNING FIELD-SYMBOL(<op>).
      <op>-arbpl = VALUE #( lt_wc[ objid = <op>-arbid ]-arbpl OPTIONAL ).
    ENDLOOP.
  ENDIF.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_CHANGEOVER_ATTR — classification values that drive setups
*"   The "attribute changeover matrix" source: characteristics on the
*"   material (allergen, colour, grade...) plus the routing setup group.
*"   ZAPS_S_CHANGEOVER: MATNR, CLASS(KLART/CLASS), CHAR_NAME(ATNAM),
*"                      CHAR_TXT(ATBEZ), VALUE_CODE(ATWRT/ATFLV), VALUE_TXT
*"----------------------------------------------------------------------
FUNCTION zaps_get_changeover_attr.
*"  IMPORTING
*"     VALUE(IV_KLART) TYPE KLASSENART DEFAULT '001'   "001 = material class
*"  TABLES
*"     IT_MATNR_RANGE STRUCTURE ZAPS_S_MATNR_RANGE OPTIONAL
*"     ET_CHANGEOVER  STRUCTURE ZAPS_S_CHANGEOVER
*"----------------------------------------------------------------------
  DATA: lr_matnr TYPE RANGE OF matnr.

  lr_matnr = VALUE #( FOR r IN it_matnr_range
                      ( sign = r-sign option = r-option low = r-low high = r-high ) ).

  " AUSP holds the assigned values per object (OBJEK = MATNR for class type
  " 001); CABN is the characteristic; CAWNT the value text. ATFLV carries
  " numeric values, ATWRT character values.
  SELECT a~objek AS matnr,
         b~atnam AS char_name, bt~atbez AS char_txt,
         a~atwrt AS value_code, a~atflv,
         wt~atwtb AS value_txt
    FROM ausp AS a
    INNER JOIN cabn AS b  ON b~atinn = a~atinn
    LEFT  JOIN cabnt AS bt ON bt~atinn = b~atinn AND bt~spras = @sy-langu
    LEFT  JOIN cawn  AS w  ON w~atinn = b~atinn AND w~atwrt = a~atwrt
    LEFT  JOIN cawnt AS wt ON wt~atinn = w~atinn AND wt~atzhl = w~atzhl
                          AND wt~spras = @sy-langu
    INTO CORRESPONDING FIELDS OF TABLE @et_changeover
    WHERE a~klart = @iv_klart
      AND a~objek IN @lr_matnr.

  " Pair with ZAPS_GET_ROUTINGS' SETUP_GROUP to reconstruct the
  " family x family changeover matrix downstream (changeovers are keyed to
  " these characteristics, not to individual materials).
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_PROD_ORDERS — released/open orders + operations (the work)
*"   ZAPS_S_PRODORDER: AUFNR, AUART(type), WERKS, MATNR(product),
*"                     GAMNG(order qty), GMEIN(uom), GLTRP(basic finish),
*"                     GSTRP(basic start), DISPO, STATUS,
*"                     OP_NO(VORNR), ARBID, STEUS, SETUP(VGW01),
*"                     MACHINE(VGW02), LABOR(VGW03)
*"----------------------------------------------------------------------
FUNCTION zaps_get_prod_orders.
*"  IMPORTING
*"     VALUE(IV_WERKS)     TYPE WERKS_D
*"     VALUE(IV_DATE_FROM) TYPE DATUM OPTIONAL
*"     VALUE(IV_DATE_TO)   TYPE DATUM OPTIONAL
*"  TABLES
*"     ET_ORDERS STRUCTURE ZAPS_S_PRODORDER
*"----------------------------------------------------------------------
  DATA: lr_gltrp TYPE RANGE OF co_gltrp.

  IF iv_date_from IS NOT INITIAL OR iv_date_to IS NOT INITIAL.
    lr_gltrp = VALUE #( ( sign = 'I' option = 'BT'
                          low = iv_date_from high = iv_date_to ) ).
  ENDIF.

  " AUFK = order master, AFKO = order header (PP), AFPO = order item,
  " AFVC = operation, AFVV = operation quantities/dates.
  SELECT k~aufnr, k~auart, k~werks AS werks,
         h~gamng, h~gmein, h~gltrp, h~gstrp, h~dispo,
         p~matnr,
         c~vornr AS op_no, c~arbid, c~steus,
         v~vgw01 AS setup, v~vgw02 AS machine, v~vgw03 AS labor
    FROM aufk AS k
    INNER JOIN afko AS h ON h~aufnr = k~aufnr
    INNER JOIN afpo AS p ON p~aufnr = k~aufnr
    LEFT  JOIN afvc AS c ON c~aufpl = h~aufpl
    LEFT  JOIN afvv AS v ON v~aufpl = c~aufpl AND v~aplzl = c~aplzl
    INTO CORRESPONDING FIELDS OF TABLE @et_orders
    WHERE k~werks = @iv_werks
      AND h~gltrp IN @lr_gltrp.

  " Status: read system status per order via STATUS_READ if the open/
  " released filter is needed (JEST/TJ02T), or BAPI_PRODORD_GET_LIST with
  " the selection profile. Left as a hook.
ENDFUNCTION.

*"----------------------------------------------------------------------
*" ZAPS_GET_REQUIREMENTS — demand/supply elements (MRP list)
*"   Thin wrapper over the standard reqs API; returns one row per element.
*"   ZAPS_S_REQUIREMENT: MATNR, WERKS, ELEMENT_TYPE(DELKZ), ELEMENT_NO(DELNR),
*"                       DATE(DAT00), QTY(MNG01), MRP_AREA(BERID)
*"----------------------------------------------------------------------
FUNCTION zaps_get_requirements.
*"  IMPORTING
*"     VALUE(IV_WERKS) TYPE WERKS_D
*"     VALUE(IV_MATNR) TYPE MATNR
*"  TABLES
*"     ET_REQUIREMENTS STRUCTURE ZAPS_S_REQUIREMENT
*"----------------------------------------------------------------------
  DATA: ls_mt61d TYPE mt61d,
        lt_mdpsx TYPE TABLE OF mdps,
        lt_mdezx TYPE TABLE OF mdez.

  CALL FUNCTION 'MD_STOCK_REQUIREMENTS_LIST_API'
    EXPORTING
      matnr                    = iv_matnr
      werks                    = iv_werks
    IMPORTING
      e_mt61d                  = ls_mt61d
    TABLES
      mdpsx                    = lt_mdpsx
      mdezx                    = lt_mdezx
    EXCEPTIONS
      material_plant_not_found = 1
      plant_not_found          = 2
      OTHERS                   = 3.

  IF sy-subrc <> 0.
    RETURN.
  ENDIF.

  " MDEZX = individual MRP elements (requirements + receipts) over time.
  et_requirements = VALUE #( FOR e IN lt_mdezx
                             ( matnr        = iv_matnr
                               werks        = iv_werks
                               element_type = e-delkz
                               element_no   = e-delnr
                               date         = e-dat00
                               qty          = e-mng01
                               mrp_area     = e-berid ) ).
ENDFUNCTION.
