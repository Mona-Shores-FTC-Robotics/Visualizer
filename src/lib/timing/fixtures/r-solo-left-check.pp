{
  "version": "2.0.0",
  "timestamp": "2026-11-04T18:50:29.543Z",
  "startPoint": {
    "x": 55.6,
    "y": 7.7,
    "locked": false,
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "line-mw0be8id-zhk73u",
      "color": "#59a14f",
      "name": "to WALL_FLOWER_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 23.1,
        "y": 47.2
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      }
    },
    {
      "id": "line-mw0cnl7i-qkksz9",
      "color": "#f28e2b",
      "name": "WALL_FLOWER_STAGING park",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 95.7
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 0
      }
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 23.1,
        "y": 47.2
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "line-mw0clsus-mahasn",
      "color": "#4e79a7",
      "name": "to LEFT_LAUNCH_OFFSET",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 41,
        "y": 121.5
      },
      "controlPoints": [
        {
          "x": 33.008507223113966,
          "y": 119.9832007271903
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 296.4
      }
    },
    {
      "id": "line-mw0cnl7i-4q4t8s",
      "color": "#59a14f",
      "name": "LEFT_LAUNCH_OFFSET park",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 95.7
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 296.4,
        "endDeg": 0
      }
    },
    {
      "id": "link-2",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 41,
        "y": 121.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 296.4
      }
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249a-6eklj4",
      "endPoint": {
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 296.4,
        "endDeg": 90
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "to SCORING_FLOWER_STAGING"
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249i-g9eamy",
      "endPoint": {
        "x": 14.5,
        "y": 95.7
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 0
      },
      "color": "#f28e2b",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "SCORING_FLOWER_STAGING park"
    },
    {
      "id": "link-3",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 450
      }
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249a-z3yeku",
      "endPoint": {
        "x": 41,
        "y": 121.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 296.4
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "to LEFT_LAUNCH_OFFSET"
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249a-0a0w4q",
      "endPoint": {
        "x": 14.5,
        "y": 95.7
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 296.4,
        "endDeg": 0
      },
      "color": "#b07aa1",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "to RIGHT_PARK"
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 41,
        "y": 121.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 296.4
      }
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249b-85xrwn",
      "endPoint": {
        "x": 41,
        "y": 20
      },
      "controlPoints": [
        {
          "x": 34,
          "y": 100
        },
        {
          "x": 26,
          "y": 45
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 296.4,
        "endDeg": 68.7
      },
      "color": "#4e79a7",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "to RIGHT_LAUNCH_OFFSET"
    },
    {
      "kind": "atomic",
      "id": "line-mw2h249b-qfhry3",
      "endPoint": {
        "x": 14.5,
        "y": 95.7
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 68.7,
        "endDeg": 0
      },
      "color": "#4e79a7",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "to RIGHT_PARK"
    }
  ],
  "shapes": [
    {
      "id": "biobuzz-red-hive",
      "name": "Red HIVE",
      "vertices": [
        {
          "x": 46,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 91.4
        },
        {
          "x": 46,
          "y": 91.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-blue-hive",
      "name": "Blue HIVE",
      "vertices": [
        {
          "x": 96.5,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 50
        },
        {
          "x": 96.5,
          "y": 50
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-top",
      "name": "Scoring-Side FLOWER",
      "vertices": [
        {
          "x": 43.4,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 139.4
        },
        {
          "x": 46.75,
          "y": 137.7
        },
        {
          "x": 43.4,
          "y": 139.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-flower-right",
      "name": "Blue Alliance FLOWER",
      "vertices": [
        {
          "x": 141.5,
          "y": 98.1
        },
        {
          "x": 139.4,
          "y": 98.1
        },
        {
          "x": 137.7,
          "y": 94.75
        },
        {
          "x": 139.4,
          "y": 91.4
        },
        {
          "x": 141.5,
          "y": 91.4
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-bottom",
      "name": "Audience-Side FLOWER",
      "vertices": [
        {
          "x": 91.15,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 2.1
        },
        {
          "x": 94.5,
          "y": 3.8
        },
        {
          "x": 91.15,
          "y": 2.1
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-left",
      "name": "Red Alliance FLOWER",
      "vertices": [
        {
          "x": 0,
          "y": 50.35
        },
        {
          "x": 2.1,
          "y": 50.35
        },
        {
          "x": 3.8,
          "y": 47
        },
        {
          "x": 2.1,
          "y": 43.65
        },
        {
          "x": 0,
          "y": 43.65
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "line-mw0be8id-zhk73u"
    },
    {
      "kind": "path",
      "lineId": "line-mw0cnl7i-qkksz9"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "line-mw0clsus-mahasn"
    },
    {
      "kind": "path",
      "lineId": "line-mw0cnl7i-4q4t8s"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249a-6eklj4"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249i-g9eamy"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249a-z3yeku"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249a-0a0w4q"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249b-85xrwn"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249b-qfhry3"
    }
  ],
  "fieldPoints": [],
  "robot": {
    "forwardVelocity": 75,
    "strafeVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rLength": 15.44,
    "rWidth": 16,
    "rForward": 0,
    "safetyMargin": 1,
    "maxVelocity": 50,
    "maxAcceleration": 50,
    "maxDeceleration": 50,
    "features": [
      {
        "name": "FLOWER poker",
        "length": 1.5,
        "width": 1.5,
        "forward": 8.5,
        "left": 0,
        "collides": true
      }
    ]
  },
  "activePaths": [],
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [
        "LaunchAll",
        "PickFlower",
        "GardenGather",
        "LaunchOne",
        "SpinUp"
      ],
      "conditions": [
        "Empty",
        "IntakeFull",
        "LeftCellUp",
        "RightCellUp",
        "Tip",
        "CameraBlind",
        "CellUp"
      ],
      "events": [
        "Tip"
      ],
      "typicalS": {
        "LaunchAll": 4.5,
        "PickFlower": 3.7,
        "GardenGather": 5,
        "LaunchOne": 0.5,
        "SpinUp": 0.1
      }
    },
    "points": {
      "RIGHT_START": [
        55.6,
        7.7,
        90
      ],
      "WALL_FLOWER_STAGING": [
        23.1,
        47.2,
        180
      ],
      "LEFT_LAUNCH_OFFSET": [
        41,
        121.5,
        296.4
      ],
      "SCORING_FLOWER_STAGING": [
        47.2,
        119.3,
        90
      ],
      "LEFT_LAUNCH_CATCH": [
        57.5,
        123.5,
        273.4
      ],
      "RIGHT_PARK": [
        14.5,
        95.7,
        0
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "RIGHT_LAUNCH_OFFSET": [
        41,
        20,
        68.7
      ]
    },
    "pathEnds": {
      "line-mw0be8id-zhk73u": "WALL_FLOWER_STAGING",
      "line-mw0clsus-mahasn": "LEFT_LAUNCH_OFFSET",
      "line-mw0cnl7i-qkksz9": "RIGHT_PARK",
      "line-mw0cnl7i-4q4t8s": "RIGHT_PARK",
      "line-mw2h249a-6eklj4": "SCORING_FLOWER_STAGING",
      "line-mw2h249a-z3yeku": "LEFT_LAUNCH_OFFSET",
      "line-mw2h249a-0a0w4q": "RIGHT_PARK",
      "line-mw2h249b-85xrwn": "RIGHT_LAUNCH_OFFSET",
      "line-mw2h249b-qfhry3": "RIGHT_PARK",
      "line-mw2h249i-g9eamy": "RIGHT_PARK"
    },
    "cards": [
      {
        "id": "c-mw0be8ic-8rwew",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "c-mw0be8ic-jdurq",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "c-mw0be8id-e596r",
        "kind": "path",
        "lineId": "line-mw0be8id-zhk73u",
        "park": false
      },
      {
        "id": "c-mw0be8id-fud0d",
        "kind": "action",
        "name": "PickFlower",
        "timeoutS": 4.5
      },
      {
        "id": "c-mw0clsus-jph23",
        "kind": "path",
        "lineId": "line-mw0clsus-mahasn",
        "park": false
      },
      {
        "id": "c-mw2h249a-c0rs6",
        "kind": "firstOf",
        "label": "Wait for TIP or CELL up",
        "rows": [
          {
            "when": [
              "CellUp"
            ],
            "cards": [
              {
                "id": "c-mw2h249a-0np9s",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "c-mw2h249a-bml5p",
                "kind": "path",
                "lineId": "line-mw2h249a-6eklj4",
                "park": false
              },
              {
                "id": "c-mw2h249a-p7er4",
                "kind": "action",
                "name": "PickFlower",
                "timeoutS": 4.5
              },
              {
                "id": "c-mw2h249a-ua9mr",
                "kind": "path",
                "lineId": "line-mw2h249a-z3yeku",
                "park": false
              },
              {
                "id": "c-mw2h249a-p5yh3",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "c-mw2h249a-nxkzp",
                "kind": "path",
                "lineId": "line-mw2h249a-0a0w4q",
                "park": true
              }
            ]
          },
          {
            "afterMs": 750,
            "cards": [
              {
                "id": "c-mw2h249b-s61q1",
                "kind": "path",
                "lineId": "line-mw2h249b-85xrwn",
                "park": false
              },
              {
                "id": "c-mw2h249b-xpbq7",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "c-mw2h249b-tphk6",
                "kind": "path",
                "lineId": "line-mw2h249b-qfhry3",
                "park": true
              }
            ]
          }
        ]
      }
    ],
    "startAt": "RIGHT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4"
    ],
    "parkFrom": {
      "c-mw0be8id-e596r": "line-mw0cnl7i-qkksz9",
      "c-mw0clsus-jph23": "line-mw0cnl7i-4q4t8s",
      "c-mw2h249a-bml5p": "line-mw2h249i-g9eamy"
    },
    "teamSpots": [
      "GARDEN_STAGING",
      "LEFT_LAUNCH_CATCH",
      "LEFT_LAUNCH_OFFSET",
      "RIGHT_LAUNCH_OFFSET",
      "RIGHT_PARK",
      "RIGHT_START",
      "SCORING_FLOWER_STAGING",
      "WALL_FLOWER_STAGING"
    ],
    "exportName": "R-Solo"
  }
}
