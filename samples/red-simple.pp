{
  "startPoint": {
    "x": 60.0,
    "y": 9.0,
    "headingDeg": 90,
    "name": "Start"
  },
  "lines": [
    {
      "id": "under-hive",
      "color": "#3fcf8e",
      "name": "UnderHive",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 110.0
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "back-to-start",
      "color": "#6b7280",
      "name": "Back to Start (never driven)",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 9.0
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "to-garden",
      "color": "#ffc516",
      "name": "ToGarden",
      "kind": "atomic",
      "endPoint": {
        "x": 24.0,
        "y": 14.0
      },
      "controlPoints": [
        {
          "x": 40.0,
          "y": 28.0
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    }
  ],
  "shapes": [
    {
      "id": "frame-leg-red",
      "name": "HIVE frame leg (red side)",
      "vertices": [
        {
          "x": 46.6,
          "y": 51.2
        },
        {
          "x": 49.4,
          "y": 51.2
        },
        {
          "x": 49.4,
          "y": 90.3
        },
        {
          "x": 46.6,
          "y": 90.3
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "frame-leg-blue",
      "name": "HIVE frame leg (blue side)",
      "vertices": [
        {
          "x": 92.6,
          "y": 51.2
        },
        {
          "x": 95.0,
          "y": 51.2
        },
        {
          "x": 95.0,
          "y": 90.3
        },
        {
          "x": 92.6,
          "y": 90.3
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "blue-half",
      "name": "Blue half: stay out",
      "vertices": [
        {
          "x": 70.8,
          "y": 0.0
        },
        {
          "x": 141.5,
          "y": 0.0
        },
        {
          "x": 141.5,
          "y": 141.5
        },
        {
          "x": 70.8,
          "y": 141.5
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "under-hive"
    },
    {
      "kind": "path",
      "lineId": "back-to-start"
    },
    {
      "kind": "path",
      "lineId": "to-garden"
    }
  ],
  "settings": {
    "xVelocity": 75,
    "yVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rWidth": 18,
    "rHeight": 18,
    "safetyMargin": 1,
    "maxVelocity": 60,
    "maxAcceleration": 55,
    "maxDeceleration": 55,
    "fieldMap": "biobuzz.webp"
  },
  "version": "1.5.0",
  "timestamp": "2026-09-29T12:00:00.000Z",
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [
        "ShootAll"
      ],
      "conditions": [
        "HiveTipped"
      ]
    },
    "points": {
      "Start": [
        60.0,
        9.0,
        90
      ],
      "RearShot": [
        60.0,
        110.0,
        90
      ],
      "Garden": [
        24.0,
        14.0,
        180
      ]
    },
    "pathEnds": {
      "under-hive": "RearShot",
      "back-to-start": "Start",
      "to-garden": "Garden"
    },
    "cards": [
      {
        "id": "shoot-preloads",
        "kind": "action",
        "name": "ShootAll",
        "previewMs": 2500
      },
      {
        "id": "tip-decision",
        "kind": "firstOf",
        "label": "Did our HIVE tip?",
        "rows": [
          {
            "when": [
              "HiveTipped"
            ],
            "label": "Tipped: under the HIVE",
            "cards": [
              {
                "id": "drive-under-hive",
                "kind": "path",
                "lineId": "under-hive",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "shoot-rear",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 2000
              }
            ]
          },
          {
            "afterMs": 3000,
            "label": "Not tipped: to the GARDEN",
            "cards": [
              {
                "id": "drive-to-garden",
                "kind": "path",
                "lineId": "to-garden",
                "while": [],
                "events": [],
                "park": false
              }
            ]
          }
        ]
      }
    ],
    "startAt": "Start",
    "exportName": "red-simple"
  }
}
