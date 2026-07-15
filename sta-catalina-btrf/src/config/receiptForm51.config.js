// sta-catalina-btrf/src/config/receiptForm51.config.js
// ---------------------------------------------------------------------------
// Overlay-print calibration for Accountable Form No. 51 (Revised Jan 1992).
//
// The physical triplicate form is PRE-PRINTED (borders, seals, headings). The
// system prints ONLY the variable data at these coordinates so each value
// seats inside its pre-printed box.
//
// Positions are PERCENT of the page (scale-independent). pageW/pageH set the
// paper size in millimetres; offX/offY nudge the whole print after a test
// print. Calibrate once per printer/pad, then paste the finished numbers here.
//
// NOTE: alignment is device/pad-specific, so this is deployment configuration,
// not business data. For multi-PC offices these values can later move into
// `municipality_settings` (JSON) and be fetched per device — the component
// already accepts a config override for that path.
// ---------------------------------------------------------------------------

export const FORM51_CONFIG = {
  pageW: 128,     // mm — measure your form's printable width
  pageH: 208,     // mm — measure your form's printable height
  offX: 0,        // mm — shift all fields right (+) / left (-)
  offY: 0,        // mm — shift all fields down (+) / up (-)
  fontSize: 11,   // px

  pos: {
    orNumber:  { x: 72,  y: 15.5 }, // system OR near the pre-printed "NO." box
    date:      { x: 19,  y: 22.2 },
    agency:    { x: 22,  y: 27.8 },
    fund:      { x: 74,  y: 27.0 },
    payor:     { x: 17,  y: 33.2 },

    // Nature-of-collection table
    firstRowY: 43.0,
    rowStep:   3.55,
    natureX:   15,
    codeX:     57.5,
    amountRightX: 90,

    totalRightX: 90,
    totalY: 66.0,

    wordsX: 15,
    wordsY: 73.8,

    // Payment mode check marks
    modeMarkX: 14.3,
    cashY: 79.0,
    checkY: 82.5,
    moY: 86.0,

    // Check / money-order detail columns
    draweeX: 41,
    instNumX: 61,
    instDateX: 80,
    checkDetailsY: 80.0,

    // Collecting officer name, centred above the pre-printed line
    collectingOfficer: { x: 50, y: 90.0 },
  },
};

// NOTE: there used to be a hard FORM51_MAX_ROWS cap here that refused to
// print past 6 lines (firstRowY 43.0 + rowStep 3.55 would otherwise run
// past totalY 66.0 and land on top of the pre-printed TOTAL box). That's
// gone now — OfficialReceiptForm51.jsx's buildOverlayHtml() compresses the
// row spacing (and shrinks the row font slightly) so any number of lines
// fits between firstRowY and totalY without overlapping TOTAL, instead of
// refusing to print.
