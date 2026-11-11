{
  "version": "2.0.0",
  "timestamp": "2026-11-11T22:39:12.552Z",
  "startPoint": {
    "x": 55.6,
    "y": 7.7,
    "locked": false,
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "r-first-pickup-flower",
      "color": "#e15759",
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
      "id": "r-pickup-park-flower",
      "color": "#e15759",
      "name": "FLOWER park to RIGHT_PARK",
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
          "x": 26,
          "y": 75
        }
      ],
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
      "id": "r-lane-north-flower",
      "color": "#e15759",
      "name": "outside lane from the FLOWER to LEFT_PAIR_OFFSET",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 128
      },
      "controlPoints": [
        {
          "x": 29.5,
          "y": 72
        },
        {
          "x": 29,
          "y": 108
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.7,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 294.4
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 294.4
              }
            }
          ]
        }
      }
    },
    {
      "id": "r-left-park",
      "color": "#e15759",
      "name": "left park to RIGHT_PARK",
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
          "x": 31,
          "y": 104
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 294.4,
        "endDeg": 360
      }
    },
    {
      "id": "link-2",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 55.6,
        "y": 7.7
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "r-first-pickup-garden",
      "color": "#e15759",
      "name": "to GARDEN_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 11.5,
        "y": 22.1
      },
      "controlPoints": [
        {
          "x": 46,
          "y": 22
        },
        {
          "x": 30,
          "y": 22.1
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 270
      }
    },
    {
      "id": "r-pickup-park-garden",
      "color": "#e15759",
      "name": "GARDEN park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "r-pickup-park-lane-garden",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 30,
            "y": 80
          },
          "controlPoints": [
            {
              "x": 30,
              "y": 30
            },
            {
              "x": 30,
              "y": 60
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 90
          }
        },
        {
          "id": "r-pickup-park-turn-garden",
          "color": "#edc948",
          "name": "",
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
              "x": 30,
              "y": 92
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        }
      ]
    },
    {
      "id": "link-3",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 11.5,
        "y": 22.1
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "r-lane-north-garden",
      "color": "#e15759",
      "name": "outside lane from the GARDEN to LEFT_PAIR_OFFSET",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 128
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 30
        },
        {
          "x": 29.5,
          "y": 72
        },
        {
          "x": 29,
          "y": 108
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.6,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 294.4
              }
            },
            {
              "startProgress": 0.6,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 294.4
              }
            }
          ]
        }
      }
    },
    {
      "id": "r-scoring-flower",
      "color": "#e15759",
      "name": "to SCORING_FLOWER_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 294.4,
        "endDeg": 450
      }
    },
    {
      "id": "r-flower-park",
      "color": "#e15759",
      "name": "scoring FLOWER park to RIGHT_PARK",
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
          "y": 100
        },
        {
          "x": 28,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 0
      }
    },
    {
      "id": "link-4",
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
      "id": "r-to-catch",
      "color": "#e15759",
      "name": "turn to LEFT_LAUNCH_CATCH",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 57.5,
        "y": 123.5
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 273.4
      }
    },
    {
      "id": "r-catch-park",
      "color": "#e15759",
      "name": "catch park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "r-catch-park-west",
          "color": "#edc948",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 40,
            "y": 122
          },
          "controlPoints": [],
          "heading": {
            "type": "linear",
            "startDeg": 273.4,
            "endDeg": 270
          }
        },
        {
          "id": "r-catch-park-clear",
          "color": "#b07aa1",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 108
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 121
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        },
        {
          "id": "r-catch-park-lane",
          "color": "#b07aa1",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 97.5
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        },
        {
          "id": "r-catch-park-in",
          "color": "#76b7b2",
          "name": "",
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
            "startDeg": 270,
            "endDeg": 360
          }
        }
      ]
    },
    {
      "id": "link-5",
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
      "id": "r-cross",
      "color": "#e15759",
      "name": "back under the HIVE to RIGHT_PAIR_CATCH",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "r-cross-out",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 59,
            "y": 97
          },
          "controlPoints": [
            {
              "x": 47.2,
              "y": 108
            },
            {
              "x": 58,
              "y": 108
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 90
          }
        },
        {
          "id": "r-cross-south",
          "color": "#59a14f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 61,
            "y": 13
          },
          "controlPoints": [
            {
              "x": 59.5,
              "y": 70
            },
            {
              "x": 61,
              "y": 40
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 96.2
          }
        }
      ]
    },
    {
      "id": "r-right-park",
      "color": "#e15759",
      "name": "outside lane to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "r-right-park-west",
          "color": "#76b7b2",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 33,
            "y": 30
          },
          "controlPoints": [
            {
              "x": 48,
              "y": 12
            },
            {
              "x": 34,
              "y": 14
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 96.2,
            "endDeg": 90
          }
        },
        {
          "id": "r-right-park-lane",
          "color": "#b07aa1",
          "name": "",
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
              "x": 30,
              "y": 60
            },
            {
              "x": 30,
              "y": 87
            }
          ],
          "heading": {
            "type": "piecewise",
            "piecewiseHeading": {
              "segments": [
                {
                  "startProgress": 0,
                  "endProgress": 0.65,
                  "interpolationType": "constant",
                  "parameters": {
                    "degrees": 90
                  }
                },
                {
                  "startProgress": 0.65,
                  "endProgress": 1,
                  "interpolationType": "linear",
                  "parameters": {
                    "startDeg": 90,
                    "endDeg": 0
                  }
                }
              ]
            }
          }
        }
      ]
    }
  ],
  "shapes": [],
  "sequence": [
    {
      "kind": "path",
      "lineId": "r-first-pickup-flower"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-flower"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "r-lane-north-flower"
    },
    {
      "kind": "path",
      "lineId": "r-left-park"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "r-first-pickup-garden"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-lane-garden"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-turn-garden"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "r-lane-north-garden"
    },
    {
      "kind": "path",
      "lineId": "r-scoring-flower"
    },
    {
      "kind": "path",
      "lineId": "r-flower-park"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "r-to-catch"
    },
    {
      "kind": "path",
      "lineId": "r-catch-park-west"
    },
    {
      "kind": "path",
      "lineId": "r-catch-park-clear"
    },
    {
      "kind": "path",
      "lineId": "r-catch-park-lane"
    },
    {
      "kind": "path",
      "lineId": "r-catch-park-in"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "r-cross-out"
    },
    {
      "kind": "path",
      "lineId": "r-cross-south"
    },
    {
      "kind": "path",
      "lineId": "r-right-park-west"
    },
    {
      "kind": "path",
      "lineId": "r-right-park-lane"
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
        "LaunchOne",
        "SpinUp",
        "PickFlower",
        "GardenGather"
      ],
      "conditions": [
        "Empty",
        "IntakeFull",
        "LeftCellUp",
        "RightCellUp",
        "CellUp",
        "Tip",
        "CameraBlind",
        "Always"
      ],
      "events": [
        "Tip"
      ],
      "typicalS": {
        "LaunchAll": 4,
        "LaunchOne": 0.5,
        "SpinUp": 0.1,
        "PickFlower": 4,
        "GardenGather": 5
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
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "LEFT_PAIR_OFFSET": [
        40,
        128,
        294.4
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
      "RIGHT_PAIR_CATCH": [
        61,
        13,
        96.2
      ],
      "RIGHT_PARK": [
        14.5,
        95.7,
        0
      ]
    },
    "pathEnds": {
      "r-first-pickup-flower": "WALL_FLOWER_STAGING",
      "r-lane-north-flower": "LEFT_PAIR_OFFSET",
      "r-pickup-park-flower": "RIGHT_PARK",
      "r-first-pickup-garden": "GARDEN_STAGING",
      "r-pickup-park-turn-garden": "RIGHT_PARK",
      "r-lane-north-garden": "LEFT_PAIR_OFFSET",
      "r-left-park": "RIGHT_PARK",
      "r-scoring-flower": "SCORING_FLOWER_STAGING",
      "r-flower-park": "RIGHT_PARK",
      "r-to-catch": "LEFT_LAUNCH_CATCH",
      "r-catch-park-in": "RIGHT_PARK",
      "r-cross-south": "RIGHT_PAIR_CATCH",
      "r-right-park-lane": "RIGHT_PARK"
    },
    "cards": [
      {
        "id": "r-spin",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "r-launch-preloads",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "r-pickup",
        "kind": "firstOf",
        "label": "Pickup: WALL_FLOWER or GARDEN",
        "rows": [
          {
            "when": [
              "Pickup"
            ],
            "label": "WALL_FLOWER",
            "cards": [
              {
                "id": "r-c-pickup-flower",
                "kind": "path",
                "lineId": "r-first-pickup-flower",
                "park": false
              },
              {
                "id": "r-grab-1-flower",
                "kind": "action",
                "name": "PickFlower",
                "timeoutS": 4.5
              },
              {
                "id": "r-c-lane-flower",
                "kind": "path",
                "lineId": "r-lane-north-flower",
                "park": false
              }
            ]
          },
          {
            "afterMs": 0,
            "label": "GARDEN",
            "cards": [
              {
                "id": "r-c-pickup-garden",
                "kind": "path",
                "lineId": "r-first-pickup-garden",
                "park": false
              },
              {
                "id": "r-grab-1-garden",
                "kind": "action",
                "name": "GardenGather",
                "timeoutS": 5.5
              },
              {
                "id": "r-c-lane-garden",
                "kind": "path",
                "lineId": "r-lane-north-garden",
                "park": false
              }
            ]
          }
        ],
        "choice": "Pickup"
      },
      {
        "id": "r-stop-2",
        "kind": "firstOf",
        "label": "R2: LEFT up by 21 s, otherwise park",
        "rows": [
          {
            "afterMs": 21000,
            "matchClock": true,
            "option": "T2 LEFT up by",
            "cards": [
              {
                "id": "r-c-left-park",
                "kind": "path",
                "lineId": "r-left-park",
                "park": true
              }
            ]
          },
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": [
              {
                "id": "r-launch-left",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "r-gate-flower",
                "kind": "firstOf",
                "label": "Time for the scoring FLOWER: before 19.4 s",
                "rows": [
                  {
                    "afterMs": 19400,
                    "matchClock": true,
                    "option": "TS scoring FLOWER by",
                    "cards": [
                      {
                        "id": "r-c-left-park-s",
                        "kind": "path",
                        "lineId": "r-left-park",
                        "park": true
                      }
                    ]
                  },
                  {
                    "when": [
                      "Always"
                    ],
                    "cards": [
                      {
                        "id": "r-c-flower",
                        "kind": "path",
                        "lineId": "r-scoring-flower",
                        "park": false
                      },
                      {
                        "id": "r-grab-2",
                        "kind": "action",
                        "name": "PickFlower",
                        "timeoutS": 4.5
                      },
                      {
                        "id": "r-gate-cross",
                        "kind": "firstOf",
                        "label": "Time to cross for TIP 3: before 16.2 s",
                        "rows": [
                          {
                            "afterMs": 16200,
                            "matchClock": true,
                            "option": "T3c cross by",
                            "cards": [
                              {
                                "id": "r-c-catch",
                                "kind": "path",
                                "lineId": "r-to-catch",
                                "park": false
                              },
                              {
                                "id": "r-stop-3",
                                "kind": "firstOf",
                                "label": "R3: RIGHT up by 22.3 s, otherwise finish TIP 2 at LEFT",
                                "rows": [
                                  {
                                    "afterMs": 22300,
                                    "matchClock": true,
                                    "option": "T3 RIGHT up by",
                                    "cards": [
                                      {
                                        "id": "r-gate-left",
                                        "kind": "firstOf",
                                        "label": "Time to shoot at LEFT: before 22.7 s",
                                        "rows": [
                                          {
                                            "afterMs": 22700,
                                            "matchClock": true,
                                            "option": "T3b LEFT shot by",
                                            "cards": [
                                              {
                                                "id": "r-hold-b",
                                                "kind": "firstOf",
                                                "label": "L has passed: park at 26.7 s",
                                                "rows": [
                                                  {
                                                    "afterMs": 26700,
                                                    "matchClock": true,
                                                    "option": "TR park at",
                                                    "cards": []
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "r-c-catch-park-b",
                                                "kind": "path",
                                                "lineId": "r-catch-park",
                                                "park": true
                                              }
                                            ]
                                          },
                                          {
                                            "when": [
                                              "Always"
                                            ],
                                            "cards": [
                                              {
                                                "id": "r-launch-left-again",
                                                "kind": "action",
                                                "name": "LaunchAll",
                                                "timeoutS": 1
                                              },
                                              {
                                                "id": "r-hold-a",
                                                "kind": "firstOf",
                                                "label": "L has passed: park at 26.7 s",
                                                "rows": [
                                                  {
                                                    "afterMs": 26700,
                                                    "matchClock": true,
                                                    "option": "TR park at",
                                                    "cards": []
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "r-c-catch-park-a",
                                                "kind": "path",
                                                "lineId": "r-catch-park",
                                                "park": true
                                              }
                                            ]
                                          }
                                        ]
                                      }
                                    ]
                                  },
                                  {
                                    "when": [
                                      "RightCellUp"
                                    ],
                                    "cards": [
                                      {
                                        "id": "r-hold-c",
                                        "kind": "firstOf",
                                        "label": "L has passed: park at 26.7 s",
                                        "rows": [
                                          {
                                            "afterMs": 26700,
                                            "matchClock": true,
                                            "option": "TR park at",
                                            "cards": []
                                          }
                                        ]
                                      },
                                      {
                                        "id": "r-c-catch-park-c",
                                        "kind": "path",
                                        "lineId": "r-catch-park",
                                        "park": true
                                      }
                                    ]
                                  }
                                ],
                                "shot": true
                              }
                            ]
                          },
                          {
                            "when": [
                              "Always"
                            ],
                            "cards": [
                              {
                                "id": "r-spill",
                                "kind": "firstOf",
                                "label": "Let TIP 2's spill land before backing under the HIVE",
                                "rows": [
                                  {
                                    "afterMs": 2300,
                                    "cards": []
                                  }
                                ]
                              },
                              {
                                "id": "r-c-cross",
                                "kind": "path",
                                "lineId": "r-cross",
                                "park": false
                              },
                              {
                                "id": "r-stop-3r",
                                "kind": "firstOf",
                                "label": "R3: RIGHT up by 21.8 s at the right spot, otherwise park",
                                "rows": [
                                  {
                                    "afterMs": 21800,
                                    "matchClock": true,
                                    "option": "T3r RIGHT up by, at the right spot",
                                    "cards": [
                                      {
                                        "id": "r-hold-right-no",
                                        "kind": "firstOf",
                                        "label": "L has left for its park: park at 24 s",
                                        "rows": [
                                          {
                                            "afterMs": 24000,
                                            "matchClock": true,
                                            "option": "TRr park from the right at",
                                            "cards": []
                                          }
                                        ]
                                      },
                                      {
                                        "id": "r-c-right-park-no",
                                        "kind": "path",
                                        "lineId": "r-right-park",
                                        "park": true
                                      }
                                    ]
                                  },
                                  {
                                    "when": [
                                      "RightCellUp"
                                    ],
                                    "cards": [
                                      {
                                        "id": "r-launch-right",
                                        "kind": "action",
                                        "name": "LaunchAll",
                                        "timeoutS": 1
                                      },
                                      {
                                        "id": "r-hold-right-yes",
                                        "kind": "firstOf",
                                        "label": "L has left for its park: park at 24 s",
                                        "rows": [
                                          {
                                            "afterMs": 24000,
                                            "matchClock": true,
                                            "option": "TRr park from the right at",
                                            "cards": []
                                          }
                                        ]
                                      },
                                      {
                                        "id": "r-c-right-park",
                                        "kind": "path",
                                        "lineId": "r-right-park",
                                        "park": true
                                      }
                                    ]
                                  }
                                ],
                                "shot": true
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ],
        "shot": true
      }
    ],
    "startAt": "RIGHT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4",
      "link-5"
    ],
    "parkFrom": {
      "r-c-pickup-flower": "r-pickup-park-flower",
      "r-c-lane-flower": "r-left-park",
      "r-c-pickup-garden": "r-pickup-park-garden",
      "r-c-lane-garden": "r-left-park",
      "r-c-flower": "r-flower-park",
      "r-c-catch": "r-catch-park",
      "r-c-cross": "r-right-park"
    },
    "partner": {
      "auto": "L-Clockwise",
      "follows": "Pickup",
      "settings": [
        "GARDEN",
        "WALL_FLOWER"
      ]
    },
    "exportName": "R-Clockwise"
  }
}