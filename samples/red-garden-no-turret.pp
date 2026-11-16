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
        "x": 60,
        "y": 21
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynq-av3b4g",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#f28e2b",
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
        "x": 60,
        "y": 21
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
      "id": "line-mwjdmynq-sucw4y",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#edc948",
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
        "x": 55.9,
        "y": 20.3
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 110
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynq-wuzduz",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#4e79a7",
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
        "x": 55.9,
        "y": 20.3
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 110
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
        "startDeg": 110,
        "endDeg": 90
      }
    },
    {
      "id": "to-entrance",
      "color": "#3fcf8e",
      "name": "ToHiveEntrance",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 33
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynq-vv1ggq",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "HiveEntrance park"
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 33
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "under-hive",
      "color": "#3fcf8e",
      "name": "UnderHive",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 104
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynr-5c2ja2",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "CorridorExit park"
    },
    {
      "id": "link-5",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 104
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "clear-to-turn",
      "color": "#3fcf8e",
      "name": "ClearToTurn",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 52,
        "y": 112
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynr-2nnhpk",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#e15759",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "ClearToTurn park"
    },
    {
      "id": "link-6",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 52,
        "y": 112
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "turn-rear-shot",
      "color": "#3fcf8e",
      "name": "TurnToLoadingCell",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 52,
        "y": 110
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 284.3
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynr-q96x31",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#f28e2b",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "RearShot park"
    },
    {
      "id": "link-7",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 52,
        "y": 110
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -75.70000000000005
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
        "y": 124
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 284.3,
        "endDeg": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynr-y9hv47",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "LoadingFlower park"
    },
    {
      "id": "link-8",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 47,
        "y": 124
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 450.00000000000006
      }
    },
    {
      "id": "turn-flower-shot",
      "color": "#3fcf8e",
      "name": "TurnToLoadingCellAgain",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47,
        "y": 122
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 287.3
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
        "degrees": 287.3
      }
    },
    {
      "id": "link-9",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60,
        "y": 9
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-garden-side",
      "color": "#ff8a3d",
      "name": "ToGardenSide",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 30
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynq-kwd0jt",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#e15759",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "GardenSide park"
    },
    {
      "id": "link-10",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 30
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-garden-flower",
      "color": "#ff8a3d",
      "name": "ToGardenFlower",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 18,
        "y": 47.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwjdmynq-w7zzpj",
      "endPoint": {
        "x": 16,
        "y": 106
      },
      "controlPoints": [],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "color": "#e15759",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "GardenFlower park"
    },
    {
      "id": "link-11",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 18,
        "y": 47.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "turn-garden-shot",
      "color": "#ff8a3d",
      "name": "TurnToGardenCell",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 24,
        "y": 47.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 20.7
      }
    },
    {
      "id": "garden-to-park",
      "color": "#ff8a3d",
      "name": "GardenToPark",
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
        "degrees": 20.7
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
      "lineId": "line-mwjdmynq-av3b4g"
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
      "lineId": "line-mwjdmynq-sucw4y"
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
      "lineId": "line-mwjdmynq-wuzduz"
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
      "lineId": "to-entrance"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynq-vv1ggq"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "under-hive"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynr-5c2ja2"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "clear-to-turn"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynr-2nnhpk"
    },
    {
      "kind": "path",
      "lineId": "link-6"
    },
    {
      "kind": "path",
      "lineId": "turn-rear-shot"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynr-q96x31"
    },
    {
      "kind": "path",
      "lineId": "link-7"
    },
    {
      "kind": "path",
      "lineId": "to-flower"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynr-y9hv47"
    },
    {
      "kind": "path",
      "lineId": "link-8"
    },
    {
      "kind": "path",
      "lineId": "turn-flower-shot"
    },
    {
      "kind": "path",
      "lineId": "to-park"
    },
    {
      "kind": "path",
      "lineId": "link-9"
    },
    {
      "kind": "path",
      "lineId": "to-garden-side"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynq-kwd0jt"
    },
    {
      "kind": "path",
      "lineId": "link-10"
    },
    {
      "kind": "path",
      "lineId": "to-garden-flower"
    },
    {
      "kind": "path",
      "lineId": "line-mwjdmynq-w7zzpj"
    },
    {
      "kind": "path",
      "lineId": "link-11"
    },
    {
      "kind": "path",
      "lineId": "turn-garden-shot"
    },
    {
      "kind": "path",
      "lineId": "garden-to-park"
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
        60,
        21,
        90
      ],
      "CollectLeft": [
        55.9,
        20.3,
        110
      ],
      "HiveEntrance": [
        60,
        33,
        90
      ],
      "CorridorExit": [
        60,
        104,
        90
      ],
      "ClearToTurn": [
        52,
        112,
        90
      ],
      "RearShot": [
        52,
        110,
        284.3
      ],
      "LoadingFlower": [
        47,
        124,
        90
      ],
      "FlowerShot": [
        47,
        122,
        287.3
      ],
      "Park": [
        16,
        106
      ],
      "GardenSide": [
        40,
        30
      ],
      "GardenFlower": [
        18,
        47.5,
        180
      ],
      "GardenShot": [
        24,
        47.5,
        20.7
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
      "to-garden-side": "GardenSide",
      "to-garden-flower": "GardenFlower",
      "turn-garden-shot": "GardenShot",
      "garden-to-park": "Park",
      "to-entrance": "HiveEntrance",
      "under-hive": "CorridorExit",
      "clear-to-turn": "ClearToTurn",
      "turn-rear-shot": "RearShot",
      "to-flower": "LoadingFlower",
      "turn-flower-shot": "FlowerShot",
      "to-park": "Park",
      "line-mwjdmynq-kwd0jt": "Park",
      "line-mwjdmynq-w7zzpj": "Park",
      "line-mwjdmynq-av3b4g": "Park",
      "line-mwjdmynq-sucw4y": "Park",
      "line-mwjdmynq-wuzduz": "Park",
      "line-mwjdmynq-vv1ggq": "Park",
      "line-mwjdmynr-5c2ja2": "Park",
      "line-mwjdmynr-2nnhpk": "Park",
      "line-mwjdmynr-q96x31": "Park",
      "line-mwjdmynr-y9hv47": "Park"
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
                "lineId": "to-entrance",
                "park": false
              },
              {
                "id": "p-8",
                "kind": "path",
                "lineId": "under-hive",
                "park": false
              },
              {
                "id": "p-9",
                "kind": "path",
                "lineId": "clear-to-turn",
                "park": false
              },
              {
                "id": "p-10",
                "kind": "path",
                "lineId": "turn-rear-shot",
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
                "id": "p-15",
                "kind": "path",
                "lineId": "turn-flower-shot",
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
                "park": true
              }
            ]
          },
          {
            "afterMs": 8000,
            "label": "If not tipped",
            "cards": [
              {
                "id": "p-18",
                "kind": "path",
                "lineId": "to-garden-side",
                "park": false
              },
              {
                "id": "p-19",
                "kind": "path",
                "lineId": "to-garden-flower",
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
                "id": "p-22",
                "kind": "path",
                "lineId": "turn-garden-shot",
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
      "link-4",
      "link-5",
      "link-6",
      "link-7",
      "link-8",
      "link-9",
      "link-10",
      "link-11"
    ],
    "parkFrom": {
      "p-18": "line-mwjdmynq-kwd0jt",
      "p-19": "line-mwjdmynq-w7zzpj",
      "p-2": "line-mwjdmynq-av3b4g",
      "p-3": "line-mwjdmynq-sucw4y",
      "p-4": "line-mwjdmynq-wuzduz",
      "p-5": "line-mwjdmynq-sucw4y",
      "p-7": "line-mwjdmynq-vv1ggq",
      "p-8": "line-mwjdmynr-5c2ja2",
      "p-9": "line-mwjdmynr-2nnhpk",
      "p-10": "line-mwjdmynr-q96x31",
      "p-12": "line-mwjdmynr-y9hv47"
    },
    "exportName": "red-garden-no-turret"
  },
  "timestamp": "2026-09-29T12:00:00.000Z"
}
