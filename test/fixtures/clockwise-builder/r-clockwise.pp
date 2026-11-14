{
  "version": "2.0.0",
  "timestamp": "2026-11-13T18:09:03.141Z",
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
        "y": 98.7
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
      "name": "outside lane from the FLOWER to LEFT_WALL_NEAR",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 37.8,
        "y": 130.7
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
              "endProgress": 0.12,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.12,
              "endProgress": 0.5,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 295.5
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 295.5
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
        "y": 98.7
      },
      "controlPoints": [
        {
          "x": 31,
          "y": 104
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 295.5,
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
          "color": "#4e79a7",
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
          "color": "#4e79a7",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 14.5,
            "y": 98.7
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
      "name": "outside lane from the GARDEN to LEFT_WALL_NEAR",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 37.8,
        "y": 130.7
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
              "endProgress": 0.1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.1,
              "endProgress": 0.2,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.5,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 295.5
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 295.5
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
      "controlPoints": [
        {
          "x": 38,
          "y": 119
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 295.5,
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
        "y": 98.7
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
      "name": "turn to LEFT_CLOSE_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 116.2
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.4,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 450,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.4,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 360,
                "endDeg": 270
              }
            }
          ]
        }
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
          "id": "r-catch-park-south",
          "color": "#59a14f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 50,
            "y": 98.7
          },
          "controlPoints": [
            {
              "x": 57,
              "y": 106
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 360
          }
        },
        {
          "id": "r-catch-park-in",
          "color": "#f28e2b",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 14.5,
            "y": 98.7
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 360
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
        "x": 59.9,
        "y": 116.2
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "r-cross",
      "color": "#e15759",
      "name": "under the HIVE to RIGHT_CLOSE_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
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
            "x": 58.3,
            "y": 41
          },
          "controlPoints": [
            {
              "x": 58.8,
              "y": 101.6
            },
            {
              "x": 62,
              "y": 71.9
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        },
        {
          "id": "r-cross-turn",
          "color": "#f28e2b",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 57.2,
            "y": 33
          },
          "controlPoints": [],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 90
          }
        },
        {
          "id": "r-cross-aim",
          "color": "#76b7b2",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 56.1,
            "y": 25.3
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 90
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
          "color": "#e15759",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 33,
            "y": 34
          },
          "controlPoints": [
            {
              "x": 46,
              "y": 27
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 90
          }
        },
        {
          "id": "r-right-park-lane",
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
            "y": 98.7
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
      "lineId": "r-catch-park-south"
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
      "lineId": "r-cross-south"
    },
    {
      "kind": "path",
      "lineId": "r-cross-turn"
    },
    {
      "kind": "path",
      "lineId": "r-cross-aim"
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
      "LEFT_WALL_NEAR": [
        37.8,
        130.7,
        295.5
      ],
      "SCORING_FLOWER_STAGING": [
        47.2,
        119.3,
        90
      ],
      "LEFT_CLOSE_HIVE": [
        59.9,
        116.2,
        270
      ],
      "RIGHT_CLOSE_HIVE": [
        56.1,
        25.3,
        90
      ],
      "RIGHT_PARK": [
        14.5,
        98.7,
        0
      ]
    },
    "pathEnds": {
      "r-first-pickup-flower": "WALL_FLOWER_STAGING",
      "r-lane-north-flower": "LEFT_WALL_NEAR",
      "r-pickup-park-flower": "RIGHT_PARK",
      "r-first-pickup-garden": "GARDEN_STAGING",
      "r-pickup-park-turn-garden": "RIGHT_PARK",
      "r-lane-north-garden": "LEFT_WALL_NEAR",
      "r-left-park": "RIGHT_PARK",
      "r-scoring-flower": "SCORING_FLOWER_STAGING",
      "r-flower-park": "RIGHT_PARK",
      "r-to-catch": "LEFT_CLOSE_HIVE",
      "r-catch-park-in": "RIGHT_PARK",
      "r-cross-aim": "RIGHT_CLOSE_HIVE",
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
        "label": "R2: LEFT up by 15.5 s, otherwise park",
        "rows": [
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
                "label": "Time for the scoring FLOWER: before 17.6 s",
                "rows": [
                  {
                    "afterMs": 17600,
                    "matchClock": true,
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
                        "id": "r-gate-left",
                        "kind": "firstOf",
                        "label": "Time to look at the HIVE from the left: before 22.2 s",
                        "rows": [
                          {
                            "afterMs": 22200,
                            "matchClock": true,
                            "cards": [
                              {
                                "id": "r-c-flower-park",
                                "kind": "path",
                                "lineId": "r-flower-park",
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
                                "id": "r-c-catch",
                                "kind": "path",
                                "lineId": "r-to-catch",
                                "park": false
                              },
                              {
                                "id": "r-stop-3",
                                "kind": "firstOf",
                                "label": "R3 RIGHT up by",
                                "rows": [
                                  {
                                    "when": [
                                      "RightCellUp"
                                    ],
                                    "cards": [
                                      {
                                        "id": "r-priority",
                                        "kind": "firstOf",
                                        "label": "Priority: THREE_TIP or PARK",
                                        "rows": [
                                          {
                                            "when": [
                                              "Priority"
                                            ],
                                            "label": "THREE_TIP",
                                            "cards": [
                                              {
                                                "id": "r-c-cross",
                                                "kind": "path",
                                                "lineId": "r-cross",
                                                "park": false
                                              },
                                              {
                                                "id": "r-launch-right",
                                                "kind": "action",
                                                "name": "LaunchAll",
                                                "timeoutS": 1
                                              },
                                              {
                                                "id": "r-c-right-park",
                                                "kind": "path",
                                                "lineId": "r-right-park",
                                                "park": true
                                              }
                                            ]
                                          },
                                          {
                                            "afterMs": 0,
                                            "label": "PARK",
                                            "cards": [
                                              {
                                                "id": "r-hold-c",
                                                "kind": "firstOf",
                                                "label": "L has passed: park at 26.4 s",
                                                "rows": [
                                                  {
                                                    "afterMs": 26400,
                                                    "matchClock": true,
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
                                        "choice": "Priority"
                                      }
                                    ]
                                  },
                                  {
                                    "afterMs": 23200,
                                    "matchClock": true,
                                    "adjustable": true,
                                    "tip": 2,
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
                                        "label": "L has passed: park at 26.4 s",
                                        "rows": [
                                          {
                                            "afterMs": 26400,
                                            "matchClock": true,
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
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "afterMs": 15500,
            "matchClock": true,
            "cards": [
              {
                "id": "r-c-left-park",
                "kind": "path",
                "lineId": "r-left-park",
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
    "exportName": "R-Clockwise"
  }
}