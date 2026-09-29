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
        "x": 60.8,
        "y": 29.5
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
        "x": 50.1,
        "y": 29.1
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 117
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
        "startDeg": 117,
        "endDeg": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "to-rear-shot",
      "color": "#3fcf8e",
      "name": "ToRearShot",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 118.8
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
      "id": "to-flower",
      "color": "#3fcf8e",
      "name": "ToLoadingFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 47,
        "y": 129.8
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
        "degrees": 90
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
      "lineId": "to-rear-shot"
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
  "timestamp": "2026-09-28T12:00:00.000Z",
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [
        "IntakeOff",
        "IntakeOn",
        "ShootAll"
      ],
      "conditions": [
        "CameraBlind",
        "HiveTipped",
        "IntakeFull"
      ]
    },
    "points": {
      "Start": [
        60.0,
        9.0,
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
        16.0,
        106.0,
        90
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
      "to-rear-shot": "RearShot",
      "to-flower": "LoadingFlower",
      "to-park": "Park"
    },
    "cards": [
      {
        "id": "a-22",
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
              "HiveTipped",
              "CameraBlind"
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
                "lineId": "to-rear-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "a-9",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 2000
              },
              {
                "id": "p-10",
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
                "id": "a-12",
                "kind": "action",
                "name": "IntakeOff"
              },
              {
                "id": "a-13",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 2000
              },
              {
                "id": "p-14",
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
                "id": "p-15",
                "kind": "path",
                "lineId": "to-rear-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "p-17",
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
                "id": "a-19",
                "kind": "action",
                "name": "IntakeOff"
              },
              {
                "id": "a-20",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 2000
              },
              {
                "id": "p-21",
                "kind": "path",
                "lineId": "to-park",
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
    "exportName": "red-garden-basic"
  }
}
