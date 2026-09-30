{
  "startPoint": {
    "x": 60.0,
    "y": 9.0,
    "headingDeg": 90,
    "name": "Start"
  },
  "lines": [
    {
      "id": "pass1-out",
      "color": "#ffc516",
      "name": "Pass1Ahead",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 21.0
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
      "id": "pass1-back",
      "color": "#ffc516",
      "name": "Pass1Back",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 10.0
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
      "id": "pass2-out",
      "color": "#ffc516",
      "name": "Pass2Left",
      "kind": "atomic",
      "endPoint": {
        "x": 55.9,
        "y": 20.3
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 110
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "pass2-back",
      "color": "#ffc516",
      "name": "Pass2Back",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 10.0
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 110,
        "endDeg": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "to-garden-side",
      "color": "#ff8a3d",
      "name": "ToGardenSide",
      "kind": "atomic",
      "endPoint": {
        "x": 40.0,
        "y": 30.0
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
      "id": "to-garden-flower",
      "color": "#ff8a3d",
      "name": "ToGardenFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 18.0,
        "y": 47.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "turn-garden-shot",
      "color": "#ff8a3d",
      "name": "TurnToGardenCell",
      "kind": "atomic",
      "endPoint": {
        "x": 24.0,
        "y": 47.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 20.7
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "garden-to-park",
      "color": "#ff8a3d",
      "name": "GardenToPark",
      "kind": "atomic",
      "endPoint": {
        "x": 16.0,
        "y": 106.0
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 20.7
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "connector",
      "color": "#6b7280",
      "name": "Connector (never driven)",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 10.0
      },
      "controlPoints": [
        {
          "x": 12.0,
          "y": 12.0
        }
      ],
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
      "id": "to-entrance",
      "color": "#3fcf8e",
      "name": "ToHiveEntrance",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 33.0
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
      "id": "under-hive",
      "color": "#3fcf8e",
      "name": "UnderHive",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 104.0
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
      "id": "clear-to-turn",
      "color": "#3fcf8e",
      "name": "ClearToTurn",
      "kind": "atomic",
      "endPoint": {
        "x": 52.0,
        "y": 112.0
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
      "id": "turn-rear-shot",
      "color": "#3fcf8e",
      "name": "TurnToLoadingCell",
      "kind": "atomic",
      "endPoint": {
        "x": 52.0,
        "y": 110.0
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 284.3
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "to-flower",
      "color": "#3fcf8e",
      "name": "ToLoadingFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 47.0,
        "y": 124.0
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 284.3,
        "endDeg": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "turn-flower-shot",
      "color": "#3fcf8e",
      "name": "TurnToLoadingCellAgain",
      "kind": "atomic",
      "endPoint": {
        "x": 47.0,
        "y": 122.0
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 287.3
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "to-park",
      "color": "#3fcf8e",
      "name": "ToPark",
      "kind": "atomic",
      "endPoint": {
        "x": 16.0,
        "y": 106.0
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 287.3
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
      "lineId": "pass1-out"
    },
    {
      "kind": "path",
      "lineId": "pass1-back"
    },
    {
      "kind": "path",
      "lineId": "pass2-out"
    },
    {
      "kind": "path",
      "lineId": "pass2-back"
    },
    {
      "kind": "path",
      "lineId": "to-garden-side"
    },
    {
      "kind": "path",
      "lineId": "to-garden-flower"
    },
    {
      "kind": "path",
      "lineId": "turn-garden-shot"
    },
    {
      "kind": "path",
      "lineId": "garden-to-park"
    },
    {
      "kind": "path",
      "lineId": "connector"
    },
    {
      "kind": "path",
      "lineId": "to-entrance"
    },
    {
      "kind": "path",
      "lineId": "under-hive"
    },
    {
      "kind": "path",
      "lineId": "clear-to-turn"
    },
    {
      "kind": "path",
      "lineId": "turn-rear-shot"
    },
    {
      "kind": "path",
      "lineId": "to-flower"
    },
    {
      "kind": "path",
      "lineId": "turn-flower-shot"
    },
    {
      "kind": "path",
      "lineId": "to-park"
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
        "IntakeOff",
        "IntakeOn",
        "LaunchAll"
      ],
      "conditions": [
        "HiveLeftGarden",
        "IntakeFull"
      ],
      "typicalS": {
        "IntakeOff": 0.2,
        "IntakeOn": 0.2,
        "LaunchAll": 3.0
      }
    },
    "points": {
      "Start": [
        60.0,
        9.0,
        90
      ],
      "CollectAhead": [
        60.0,
        21.0,
        90
      ],
      "CollectLeft": [
        55.9,
        20.3,
        110
      ],
      "HiveEntrance": [
        60.0,
        33.0,
        90
      ],
      "CorridorExit": [
        60.0,
        104.0,
        90
      ],
      "ClearToTurn": [
        52.0,
        112.0,
        90
      ],
      "RearShot": [
        52.0,
        110.0,
        284.3
      ],
      "LoadingFlower": [
        47.0,
        124.0,
        90
      ],
      "FlowerShot": [
        47.0,
        122.0,
        287.3
      ],
      "Park": [
        16.0,
        106.0
      ],
      "GardenSide": [
        40.0,
        30.0
      ],
      "GardenFlower": [
        18.0,
        47.5,
        180
      ],
      "GardenShot": [
        24.0,
        47.5,
        20.7
      ],
      "CollectHome": [
        60.0,
        10.0,
        90
      ]
    },
    "pathEnds": {
      "pass1-out": "CollectAhead",
      "pass1-back": "CollectHome",
      "pass2-out": "CollectLeft",
      "pass2-back": "CollectHome",
      "to-garden-side": "GardenSide",
      "to-garden-flower": "GardenFlower",
      "turn-garden-shot": "GardenShot",
      "garden-to-park": "Park",
      "connector": "CollectHome",
      "to-entrance": "HiveEntrance",
      "under-hive": "CorridorExit",
      "clear-to-turn": "ClearToTurn",
      "turn-rear-shot": "RearShot",
      "to-flower": "LoadingFlower",
      "turn-flower-shot": "FlowerShot",
      "to-park": "Park"
    },
    "cards": [
      {
        "id": "a-25",
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
              "HiveLeftGarden"
            ],
            "label": "If tipped",
            "cards": [
              {
                "id": "a-1",
                "kind": "action",
                "name": "IntakeOn"
              },
              {
                "id": "p-2",
                "kind": "path",
                "lineId": "pass1-out",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-3",
                "kind": "path",
                "lineId": "pass1-back",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-4",
                "kind": "path",
                "lineId": "pass2-out",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-5",
                "kind": "path",
                "lineId": "pass2-back",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "a-6",
                "kind": "action",
                "name": "IntakeOff"
              },
              {
                "id": "p-7",
                "kind": "path",
                "lineId": "to-entrance",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-8",
                "kind": "path",
                "lineId": "under-hive",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-9",
                "kind": "path",
                "lineId": "clear-to-turn",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-10",
                "kind": "path",
                "lineId": "turn-rear-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "a-11",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-12",
                "kind": "path",
                "lineId": "to-flower",
                "while": [],
                "events": [
                  {
                    "at": 0.7,
                    "action": "IntakeOn"
                  }
                ],
                "park": false
              },
              {
                "id": "w-13",
                "kind": "firstOf",
                "label": "Take 4 POLLEN from the RED_LOADING FLOWER",
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
                "id": "a-14",
                "kind": "action",
                "name": "IntakeOff"
              },
              {
                "id": "p-15",
                "kind": "path",
                "lineId": "turn-flower-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "a-16",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-17",
                "kind": "path",
                "lineId": "to-park",
                "while": [],
                "events": [],
                "park": true
              }
            ]
          },
          {
            "afterMs": 5000,
            "label": "If not tipped",
            "cards": [
              {
                "id": "p-18",
                "kind": "path",
                "lineId": "to-garden-side",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-19",
                "kind": "path",
                "lineId": "to-garden-flower",
                "while": [],
                "events": [
                  {
                    "at": 0.7,
                    "action": "IntakeOn"
                  }
                ],
                "park": false
              },
              {
                "id": "w-20",
                "kind": "firstOf",
                "label": "Take 4 POLLEN from the RED_GARDEN FLOWER",
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
                "id": "a-21",
                "kind": "action",
                "name": "IntakeOff"
              },
              {
                "id": "p-22",
                "kind": "path",
                "lineId": "turn-garden-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "a-23",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "p-24",
                "kind": "path",
                "lineId": "garden-to-park",
                "while": [],
                "events": [],
                "park": true
              }
            ]
          }
        ]
      }
    ],
    "startAt": "Start",
    "exportName": "red-garden-no-turret"
  }
}
