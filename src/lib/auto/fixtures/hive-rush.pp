{
  "startPoint": {
    "x": 38,
    "y": 71,
    "headingDeg": 0
  },
  "lines": [
    {
      "id": "near-collect",
      "color": "#ff8a3d",
      "name": "CollectNear",
      "kind": "atomic",
      "endPoint": {
        "x": 26,
        "y": 120
      },
      "controlPoints": [
        {
          "x": 18,
          "y": 88
        }
      ],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "near-back",
      "color": "#ff8a3d",
      "name": "BackToShoot",
      "kind": "atomic",
      "endPoint": {
        "x": 38,
        "y": 71
      },
      "controlPoints": [
        {
          "x": 34,
          "y": 100
        }
      ],
      "heading": {
        "type": "constant",
        "degrees": 0
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "far-to",
      "color": "#3fcf8e",
      "name": "ToFarPickups",
      "kind": "atomic",
      "endPoint": {
        "x": 116,
        "y": 120
      },
      "controlPoints": [
        {
          "x": 34,
          "y": 128
        },
        {
          "x": 98,
          "y": 134
        }
      ],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "far-collect",
      "color": "#3fcf8e",
      "name": "CollectFar",
      "kind": "compound",
      "segments": [
        {
          "id": "far-collect-a",
          "color": "#3fcf8e",
          "name": "",
          "kind": "atomic",
          "endPoint": {
            "x": 128,
            "y": 120
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
          },
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": ""
        },
        {
          "id": "far-collect-b",
          "color": "#3fcf8e",
          "name": "",
          "kind": "atomic",
          "endPoint": {
            "x": 128,
            "y": 104
          },
          "controlPoints": [
            {
              "x": 134,
              "y": 112
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 0
          },
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": ""
        }
      ],
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "far-up",
      "color": "#3fcf8e",
      "name": "ToUpCellShot",
      "kind": "atomic",
      "endPoint": {
        "x": 108,
        "y": 84
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 45
              }
            }
          ]
        }
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "far-park",
      "color": "#3fcf8e",
      "name": "ParkFarPath",
      "kind": "atomic",
      "endPoint": {
        "x": 124,
        "y": 28
      },
      "controlPoints": [
        {
          "x": 112,
          "y": 56
        }
      ],
      "heading": {
        "type": "tangential",
        "reverse": false
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    }
  ],
  "shapes": [
    {
      "id": "hive",
      "name": "HIVE",
      "vertices": [
        {
          "x": 46,
          "y": 41
        },
        {
          "x": 96,
          "y": 41
        },
        {
          "x": 96,
          "y": 91
        },
        {
          "x": 46,
          "y": 91
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "near-collect"
    },
    {
      "kind": "path",
      "lineId": "near-back"
    },
    {
      "kind": "path",
      "lineId": "far-to"
    },
    {
      "kind": "path",
      "lineId": "far-collect-a"
    },
    {
      "kind": "path",
      "lineId": "far-collect-b"
    },
    {
      "kind": "path",
      "lineId": "far-up"
    },
    {
      "kind": "path",
      "lineId": "far-park"
    }
  ],
  "fieldPoints": [],
  "settings": {
    "xVelocity": 75,
    "yVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rWidth": 16,
    "rHeight": 16,
    "safetyMargin": 1,
    "maxVelocity": 60,
    "maxAcceleration": 55,
    "maxDeceleration": 55,
    "fieldMap": "biobuzz.webp"
  },
  "auto": {
    "version": 1,
    "drawnFor": "BLUE",
    "registry": {
      "actions": [
        "SpinUp",
        "ShootAll",
        "IntakeOn",
        "IntakeOff",
        "SpinDown"
      ],
      "conditions": [
        "LauncherReady",
        "HiveTipped",
        "CameraBlind",
        "IntakeFull"
      ]
    },
    "points": {
      "ShootSpot": [
        38,
        71
      ],
      "NearPickup": [
        26,
        120
      ],
      "FarPickup": [
        116,
        120
      ],
      "UpCellShot": [
        108,
        84,
        45
      ],
      "ParkFar": [
        124,
        28
      ]
    },
    "routines": {
      "CollectFar": {
        "steps": [
          {
            "forward": 12,
            "left": 0
          },
          {
            "forward": 12,
            "left": -16,
            "control": [
              18,
              -8
            ]
          }
        ],
        "endsWhen": "IntakeFull",
        "timeoutMs": 2500,
        "while": [
          "IntakeOn"
        ],
        "exit": [
          "IntakeOff",
          "SpinUp"
        ]
      }
    },
    "cards": [
      {
        "id": "spin-up",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "wait-ready",
        "kind": "firstOf",
        "label": "Wait for LauncherReady",
        "rows": [
          {
            "when": [
              "LauncherReady"
            ],
            "cards": []
          },
          {
            "afterMs": 800,
            "cards": []
          }
        ]
      },
      {
        "id": "shoot-preload",
        "kind": "action",
        "name": "ShootAll",
        "previewMs": 1600
      },
      {
        "id": "did-tip",
        "kind": "firstOf",
        "label": "Did the HIVE tip?",
        "rows": [
          {
            "when": [
              "HiveTipped",
              "CameraBlind"
            ],
            "label": "If tipped",
            "cards": [
              {
                "id": "tip-1",
                "kind": "path",
                "lineId": "far-to",
                "while": [
                  "SpinDown"
                ],
                "events": [
                  {
                    "at": 0.6,
                    "action": "IntakeOn"
                  }
                ],
                "park": false
              },
              {
                "id": "tip-2",
                "kind": "routine",
                "routine": "CollectFar",
                "at": "FarPickup",
                "facingDeg": 0,
                "mirror": false,
                "exit": "UpCellShot"
              },
              {
                "id": "tip-5",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 1600
              },
              {
                "id": "tip-6",
                "kind": "path",
                "lineId": "far-park",
                "while": [],
                "events": [],
                "park": true
              }
            ]
          },
          {
            "afterMs": 1500,
            "label": "If not tipped",
            "cards": [
              {
                "id": "near-1",
                "kind": "path",
                "lineId": "near-collect",
                "while": [],
                "events": [
                  {
                    "at": 0.35,
                    "action": "IntakeOn"
                  }
                ],
                "park": false
              },
              {
                "id": "near-2",
                "kind": "firstOf",
                "label": "Wait for IntakeFull",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 1800,
                    "cards": []
                  }
                ]
              },
              {
                "id": "near-3",
                "kind": "together",
                "label": "Back and spin up",
                "ends": "ALL",
                "cards": [
                  {
                    "id": "near-3a",
                    "kind": "path",
                    "lineId": "near-back",
                    "while": [
                      "IntakeOff"
                    ],
                    "events": [],
                    "park": false
                  },
                  {
                    "id": "near-3b",
                    "kind": "action",
                    "name": "SpinUp",
                    "previewMs": 900
                  }
                ]
              },
              {
                "id": "near-4",
                "kind": "action",
                "name": "ShootAll",
                "previewMs": 1600
              },
              {
                "id": "near-5",
                "kind": "firstOf",
                "label": "Did it tip this time?",
                "rows": [
                  {
                    "when": [
                      "HiveTipped"
                    ],
                    "label": "Tipped late",
                    "cards": [
                      {
                        "id": "late-1",
                        "kind": "path",
                        "lineId": "far-to",
                        "while": [
                          "SpinDown"
                        ],
                        "events": [
                          {
                            "at": 0.6,
                            "action": "IntakeOn"
                          }
                        ],
                        "park": false
                      },
                      {
                        "id": "late-2",
                        "kind": "path",
                        "lineId": "far-collect",
                        "while": [
                          "IntakeOn"
                        ],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "late-3",
                        "kind": "action",
                        "name": "IntakeOff"
                      },
                      {
                        "id": "late-4",
                        "kind": "path",
                        "lineId": "far-up",
                        "while": [
                          "SpinUp"
                        ],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "late-5",
                        "kind": "action",
                        "name": "ShootAll",
                        "previewMs": 1600
                      },
                      {
                        "id": "late-6",
                        "kind": "path",
                        "lineId": "far-park",
                        "while": [],
                        "events": [],
                        "park": true
                      }
                    ]
                  },
                  {
                    "timeLeftBelowS": 6,
                    "label": "Out of time",
                    "cards": [
                      {
                        "id": "late-hold",
                        "kind": "goTo",
                        "label": "Hold at ShootSpot",
                        "point": "ShootSpot",
                        "maxDistanceIn": 6,
                        "ifRefused": [
                          {
                            "id": "late-out",
                            "kind": "action",
                            "name": "SpinDown"
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "otherwise": true,
                    "cards": []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "version": "1.5.0"
}
