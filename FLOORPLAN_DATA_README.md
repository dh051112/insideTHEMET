# Met Floor Plan Data

Extracted from the official Met Fifth Avenue floor plan PDF and joined with
`MetObjects_highlights_publicdomain_categorized.csv` (1,013 on-view, highlight,
public-domain objects).

## Files

### `met_floorplan.json` — main deliverable
Ready to load in the prototype. Structure:

```
{
  "meta": { ...provenance notes... },
  "floors": {
    "1": {
      "label": "Floor 1",
      "viewBox": "0 0 1000 600",
      "pdf_extent": { minx, maxx, miny, maxy },   // original PDF bounds used for normalization
      "zones": [
        {
          "department": "Egyptian Art",
          "color": "#BA7517",
          "n_objects": 97,
          "n_galleries": 26,
          "bbox": { x0, y0, x1, y1 },              // zone bounding box (normalized 0-1000 x 0-600)
          "centroid": { x, y },
          "rooms": [
            {
              "gallery": 119,
              "count": 14,                          // # objects in this gallery
              "x": 956.2, "y": 453.7,               // normalized coords (for SVG)
              "pdf_x": 734.0, "pdf_y": 1087.0,      // original PDF coords (re-normalize if needed)
              "categories": { "Sculpture": 10, "Jewelry & ornaments": 4 }
            },
            ...
          ]
        },
        ...
      ]
    },
    "2": { ... },
    "3": {                                          // Lower & Special: NO coords
      "label": "Lower & Special",
      "zones": [ { "department": "The Cloisters", "rooms": [...], "note": "..." } ]
    }
  },
  "unplaced": { "Egyptian Art": [114, 125], ... }   // galleries in CSV but not found in PDF
}
```

**Coordinate system**
- `x`/`y` are normalized per floor to a `0 0 1000 600` viewBox. y increases
  downward (SVG convention) — matches the PDF orientation, so north is up.
- `pdf_x`/`pdf_y` are the raw PDF points. If you want a different viewBox or
  want to re-normalize after adding the unplaced galleries, use these +
  `pdf_extent`.
- Zones are sorted by `n_objects` descending. Rooms within a zone too.

**How to render**
1. Main map: draw each zone's `bbox` as a rounded rect, fill with `color` at low
   opacity, label with `department` + `n_objects`. Use `centroid` for the label.
2. Detail view (on zone click): draw that zone's `rooms` as cells at their
   `x`/`y`, sized/labeled by `count`. Each room has a `categories` breakdown.
3. Floor toggle switches `floors.1` / `floors.2` / `floors.3`.

### `met_pdf_gallery_coords_raw.json` — raw lookup table
Every gallery number found in the PDF with its coordinate, split by floor band
(`floor1` = y≥660 in PDF space, `floor2_3` = y<660). Use this to manually place
the `unplaced` galleries or to re-derive zones with different rules.

```
{ "floor1": { "119": {"x": 734.0, "y": 1087.0}, ... },
  "floor2_3": { "604": {"x": 305.2, "y": 287.1}, ... } }
```

## Known data gaps (the `unplaced` field)

These CSV galleries had no number label in the PDF, so they're not placed:

| Department | Unplaced galleries | Why |
|---|---|---|
| The Cloisters | 1–20, 301 | Separate building, not on this PDF → Floor 3 list |
| European Paintings | 800, 806–827 (several) | 800s number labels sparse in PDF; some overlap |
| European Sculpture & Dec. Arts | 503, 505, 516, 800 | Small galleries, no label in PDF |
| Egyptian Art | 114, 125 | Small galleries, no label in PDF |
| American Wing | 712, 714 | Floor 3 mezzanine, tiny |
| Medieval Art | 14, 301 | 14 = Cloisters; 301 shared w/ stairs |
| Islamic Art | 451 | No label in PDF |

~919 of 1,013 objects (91%) are placed on Floor 1 / Floor 2. ~50 are Cloisters
(Floor 3, no coords). The rest (~44) are in unplaced galleries — you can add
coords manually from the raw lookup, approximate them near their neighbors, or
fold them into the nearest same-department room.

## Floor assignment

Departments spanning two floors (American Wing 700s, European Paintings 600/800s)
have their galleries split by whichever floor the PDF shows each gallery on.
The `DEPT_PRIMARY` map in the build script decides ambiguous cases. American
Wing correctly splits: 17 galleries on F1, 32 on F2.
