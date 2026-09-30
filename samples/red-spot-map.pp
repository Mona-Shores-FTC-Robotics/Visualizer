{
  "startPoint": {
    "x": 59,
    "y": 9.5,
    "name": "RIGHT_START",
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "to-right-hive-entrance",
      "color": "#3fcf8e",
      "name": "to RIGHT_HIVE_ENTRANCE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 47
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 90
      }
    },
    {
      "id": "to-left-hive-entrance",
      "color": "#3fcf8e",
      "name": "to LEFT_HIVE_ENTRANCE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 94.7
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 90
      }
    },
    {
      "id": "to-left-dump",
      "color": "#3fcf8e",
      "name": "to LEFT_DUMP",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 117.8
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 308
      }
    },
    {
      "id": "to-left-flower",
      "color": "#3fcf8e",
      "name": "to LEFT_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.5,
        "y": 129
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 308,
        "endDeg": 90
      }
    },
    {
      "id": "to-left-start",
      "color": "#3fcf8e",
      "name": "to LEFT_START",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 132
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 270
      }
    },
    {
      "id": "to-left-loading-zone",
      "color": "#3fcf8e",
      "name": "to LEFT_LOADING_ZONE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 115.7
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 90
      }
    },
    {
      "id": "to-right-loading-zone",
      "color": "#3fcf8e",
      "name": "to RIGHT_LOADING_ZONE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 96.6
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 90
      }
    },
    {
      "id": "to-your-wall-flower",
      "color": "#3fcf8e",
      "name": "to YOUR_WALL_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 15.2,
        "y": 47.8
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      }
    },
    {
      "id": "to-right-dump",
      "color": "#3fcf8e",
      "name": "to RIGHT_DUMP",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 23.7
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 52
      }
    },
    {
      "id": "to-garden",
      "color": "#3fcf8e",
      "name": "to GARDEN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 10.5,
        "y": 11.8
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 52,
        "endDeg": 180
      }
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
          "x": 95,
          "y": 51.2
        },
        {
          "x": 95,
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
          "y": 0
        },
        {
          "x": 141.5,
          "y": 0
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
      "lineId": "to-right-hive-entrance"
    },
    {
      "kind": "path",
      "lineId": "to-left-hive-entrance"
    },
    {
      "kind": "path",
      "lineId": "to-left-dump"
    },
    {
      "kind": "path",
      "lineId": "to-left-flower"
    },
    {
      "kind": "path",
      "lineId": "to-left-start"
    },
    {
      "kind": "path",
      "lineId": "to-left-loading-zone"
    },
    {
      "kind": "path",
      "lineId": "to-right-loading-zone"
    },
    {
      "kind": "path",
      "lineId": "to-your-wall-flower"
    },
    {
      "kind": "path",
      "lineId": "to-right-dump"
    },
    {
      "kind": "path",
      "lineId": "to-garden"
    }
  ],
  "fieldPoints": [],
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
    "fieldMap": "biobuzz.webp",
    "robotImage": "/robot.png",
    "showGhostPaths": false,
    "showOnionLayers": false,
    "onionLayerSpacing": 3,
    "onionColor": "#dc2626",
    "onionNextPointOnly": false,
    "showHeadingArrow": false,
    "showCurrentTValue": false,
    "leftPanelWidth": 262,
    "rightPanelWidth": 714,
    "headingArrowLength": 50,
    "headingArrowColor": "#ffffff",
    "headingArrowThickness": 2,
    "pathOpacity": 1,
    "leftPanelMinWidth": 0,
    "rightPanelMinWidth": 0,
    "penToolMaxPaths": 8,
    "curveThroughMaxPoints": 4,
    "experimentalFeatures": {
      "optimize": false,
      "curveThrough": false
    }
  },
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [],
      "conditions": []
    },
    "points": {
      "RIGHT_START": [
        59,
        9.5,
        90
      ],
      "RIGHT_HIVE_ENTRANCE": [
        59,
        47,
        90
      ],
      "LEFT_HIVE_ENTRANCE": [
        59,
        94.7,
        90
      ],
      "LEFT_DUMP": [
        59,
        117.8,
        308
      ],
      "LEFT_FLOWER": [
        47.5,
        129,
        90
      ],
      "LEFT_START": [
        59,
        132,
        270
      ],
      "LEFT_LOADING_ZONE": [
        16,
        115.7,
        90
      ],
      "RIGHT_LOADING_ZONE": [
        16,
        96.6,
        90
      ],
      "YOUR_WALL_FLOWER": [
        15.2,
        47.8,
        180
      ],
      "RIGHT_DUMP": [
        59,
        23.7,
        52
      ],
      "GARDEN": [
        10.5,
        11.8,
        180
      ]
    },
    "pathEnds": {
      "to-right-hive-entrance": "RIGHT_HIVE_ENTRANCE",
      "to-left-hive-entrance": "LEFT_HIVE_ENTRANCE",
      "to-left-dump": "LEFT_DUMP",
      "to-left-flower": "LEFT_FLOWER",
      "to-left-start": "LEFT_START",
      "to-left-loading-zone": "LEFT_LOADING_ZONE",
      "to-right-loading-zone": "RIGHT_LOADING_ZONE",
      "to-your-wall-flower": "YOUR_WALL_FLOWER",
      "to-right-dump": "RIGHT_DUMP",
      "to-garden": "GARDEN"
    },
    "cards": [
      {
        "id": "visit-1",
        "kind": "path",
        "lineId": "to-right-hive-entrance",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-2",
        "kind": "path",
        "lineId": "to-left-hive-entrance",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-3",
        "kind": "path",
        "lineId": "to-left-dump",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-4",
        "kind": "path",
        "lineId": "to-left-flower",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-5",
        "kind": "path",
        "lineId": "to-left-start",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-6",
        "kind": "path",
        "lineId": "to-left-loading-zone",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-7",
        "kind": "path",
        "lineId": "to-right-loading-zone",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-8",
        "kind": "path",
        "lineId": "to-your-wall-flower",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-9",
        "kind": "path",
        "lineId": "to-right-dump",
        "while": [],
        "events": [],
        "park": false
      },
      {
        "id": "visit-10",
        "kind": "path",
        "lineId": "to-garden",
        "while": [],
        "events": [],
        "park": false
      }
    ],
    "startAt": "RIGHT_START",
    "exportName": "red-spot-map"
  },
  "version": "1.5.0",
  "timestamp": "2026-09-30T01:43:49.669Z"
}