{
  "version": "2.0.0",
  "startPoint": {
    "x": 60,
    "y": 9,
    "name": "Start",
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "pass1-out",
      "color": "#ffc516",
      "name": "Pass1Ahead",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60.8,
        "y": 29.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmync-2yata3",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      },
      "color": "#b07aa1",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "CollectAhead park"
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60.8,
        "y": 29.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "pass1-back",
      "color": "#ffc516",
      "name": "Pass1Back",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmync-bxuy4u",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      },
      "color": "#b07aa1",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "CollectHome park"
    },
    {
      "id": "link-2",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "pass2-out",
      "color": "#ffc516",
      "name": "Pass2Left",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50.1,
        "y": 29.1
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 117
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmync-bxj9e6",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 117,
        "endDeg": 90
      },
      "color": "#9c755f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "CollectLeft park"
    },
    {
      "id": "link-3",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 50.1,
        "y": 29.1
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 117
      }
    },
    {
      "id": "pass2-back",
      "color": "#ffc516",
      "name": "Pass2Back",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 117,
        "endDeg": 90
      }
    },
    {
      "id": "to-rear-shot",
      "color": "#3fcf8e",
      "name": "ToRearShot",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 118.8
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmync-teq0v2",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      },
      "color": "#b07aa1",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "RearShot park"
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 118.8
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-flower",
      "color": "#3fcf8e",
      "name": "ToLoadingFlower",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47,
        "y": 129.8
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-park",
      "color": "#3fcf8e",
      "name": "ToPark",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
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
      "lineId": "pass1-out"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmync-2yata3"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "pass1-back"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmync-bxuy4u"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "pass2-out"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmync-bxj9e6"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "pass2-back"
    },
    {
      "kind": "path",
      "lineId": "to-rear-shot"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmync-teq0v2"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "to-flower"
    },
    {
      "kind": "path",
      "lineId": "to-park"
    }
  ],
  "fieldPoints": [],
  "robot": {
    "forwardVelocity": 75,
    "strafeVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rLength": 18,
    "rWidth": 18,
    "safetyMargin": 1,
    "maxVelocity": 60,
    "maxAcceleration": 55,
    "maxDeceleration": 55
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
        "Tip",
        "IntakeFull",
        "Empty",
        "LeftCellUp",
        "RightCellUp",
        "CellUp",
        "CameraBlind",
        "Always"
      ],
      "typicalS": {
        "LaunchAll": 3,
        "PickFlower": 4.4,
        "GardenGather": 6,
        "LaunchOne": 0.5,
        "SpinUp": 0.1
      }
    },
    "points": {
      "Start": [
        60,
        9,
        90
      ],
      "CollectAhead": [
        60.8,
        29.5,
        90
      ],
      "CollectLeft": [
        50.1,
        29.1,
        117
      ],
      "RearShot": [
        60,
        118.8,
        90
      ],
      "LoadingFlower": [
        47,
        129.8,
        90
      ],
      "Park": [
        16,
        106,
        90
      ],
      "CollectHome": [
        60,
        10,
        90
      ]
    },
    "pathEnds": {
      "pass1-out": "CollectAhead",
      "pass1-back": "CollectHome",
      "pass2-out": "CollectLeft",
      "pass2-back": "CollectHome",
      "to-rear-shot": "RearShot",
      "to-flower": "LoadingFlower",
      "to-park": "Park",
      "line-mwjdmync-teq0v2": "Park",
      "line-mwjdmync-2yata3": "Park",
      "line-mwjdmync-bxuy4u": "Park",
      "line-mwjdmync-bxj9e6": "Park"
    },
    "cards": [
      {
        "id": "tip-decision-launch",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "tip-decision",
        "kind": "firstOf",
        "label": "Did our HIVE tip?",
        "rows": [
          {
            "when": [
              "Tip"
            ],
            "label": "If tipped",
            "cards": [
              {
                "id": "p-2",
                "kind": "path",
                "lineId": "pass1-out",
                "park": false
              },
              {
                "id": "p-3",
                "kind": "path",
                "lineId": "pass1-back",
                "park": false
              },
              {
                "id": "p-4",
                "kind": "path",
                "lineId": "pass2-out",
                "park": false
              },
              {
                "id": "p-5",
                "kind": "path",
                "lineId": "pass2-back",
                "park": false
              },
              {
                "id": "p-7",
                "kind": "path",
                "lineId": "to-rear-shot",
                "park": false
              },
              {
                "id": "a-9",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-10",
                "kind": "path",
                "lineId": "to-flower",
                "park": false
              },
              {
                "id": "w-11",
                "kind": "firstOf",
                "label": "Take 4 POLLEN from the LOADING FLOWER",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 1500,
                    "cards": []
                  }
                ]
              },
              {
                "id": "a-13",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-14",
                "kind": "path",
                "lineId": "to-park",
                "park": true
              }
            ]
          },
          {
            "afterMs": 8000,
            "label": "If not tipped",
            "cards": [
              {
                "id": "p-15",
                "kind": "path",
                "lineId": "to-rear-shot",
                "park": false
              },
              {
                "id": "p-17",
                "kind": "path",
                "lineId": "to-flower",
                "park": false
              },
              {
                "id": "w-18",
                "kind": "firstOf",
                "label": "Take 4 POLLEN from the LOADING FLOWER",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 1500,
                    "cards": []
                  }
                ]
              },
              {
                "id": "a-20",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-21",
                "kind": "path",
                "lineId": "to-park",
                "park": true
              }
            ]
          }
        ]
      }
    ],
    "startAt": "Start",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4"
    ],
    "parkFrom": {
      "p-15": "line-mwjdmync-teq0v2",
      "p-2": "line-mwjdmync-2yata3",
      "p-3": "line-mwjdmync-bxuy4u",
      "p-4": "line-mwjdmync-bxj9e6",
      "p-5": "line-mwjdmync-bxuy4u",
      "p-7": "line-mwjdmync-teq0v2"
    },
    "exportName": "red-garden-basic"
  }
}
