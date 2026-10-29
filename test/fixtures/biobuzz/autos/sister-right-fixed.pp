{
  "startPoint": {
    "x": 55,
    "y": 9.7,
    "name": "START",
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "to-r-pre-1",
      "color": "#3cc8e4",
      "name": "START to R_PRE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 57,
        "y": 20
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-s-catch-2",
      "color": "#3cc8e4",
      "name": "R_PRE to S_CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 57.5,
        "y": 21
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-garden-in-3",
      "color": "#3cc8e4",
      "name": "S_CATCH to GARDEN_IN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 9.5,
        "y": 20.56
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.1,
              "endProgress": 0.7,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-garden-4",
      "color": "#3cc8e4",
      "name": "GARDEN_IN to GARDEN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 9.5,
        "y": 10.96
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "to-r-s-5",
      "color": "#3cc8e4",
      "name": "GARDEN to R_S",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 22
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-r-w-6",
      "color": "#3cc8e4",
      "name": "R_S to R_W",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 40
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-r-n-7",
      "color": "#3cc8e4",
      "name": "R_W to R_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 104
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-wall-flower-turn-8",
      "color": "#3cc8e4",
      "name": "R_S to WALL_FLOWER_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 23.16,
        "y": 47.36
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-flower-9",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER_TURN to WALL_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.86,
        "y": 47.36
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "to-r-n-10",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER to R_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 104
      },
      "controlPoints": [
        {
          "x": 24.86,
          "y": 47.36
        },
        {
          "x": 30,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-flower-turn-11",
      "color": "#3cc8e4",
      "name": "R_S to WALL_FLOWER_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 23.16,
        "y": 47.36
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-flower-12",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER_TURN to WALL_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.86,
        "y": 47.36
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "to-r-n-13",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER to R_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 104
      },
      "controlPoints": [
        {
          "x": 24.86,
          "y": 47.36
        },
        {
          "x": 30,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-r-w-14",
      "color": "#3cc8e4",
      "name": "S_CATCH to R_W",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 40
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-r-n-15",
      "color": "#3cc8e4",
      "name": "R_W to R_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 104
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-park-16",
      "color": "#3cc8e4",
      "name": "R_N to PARK",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14,
        "y": 95
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
      "lineId": "to-r-pre-1"
    },
    {
      "kind": "path",
      "lineId": "to-s-catch-2"
    },
    {
      "kind": "path",
      "lineId": "to-garden-in-3"
    },
    {
      "kind": "path",
      "lineId": "to-garden-4"
    },
    {
      "kind": "path",
      "lineId": "to-r-s-5"
    },
    {
      "kind": "path",
      "lineId": "to-r-w-6"
    },
    {
      "kind": "path",
      "lineId": "to-r-n-7"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-turn-8"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-9"
    },
    {
      "kind": "path",
      "lineId": "to-r-n-10"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-turn-11"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-12"
    },
    {
      "kind": "path",
      "lineId": "to-r-n-13"
    },
    {
      "kind": "path",
      "lineId": "to-r-w-14"
    },
    {
      "kind": "path",
      "lineId": "to-r-n-15"
    },
    {
      "kind": "path",
      "lineId": "to-park-16"
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
    "maxVelocity": 50,
    "maxAcceleration": 45.0,
    "maxDeceleration": 45.0,
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
    "exportName": "sister-right-fixed",
    "registry": {
      "actions": [
        "SpinUp",
        "LaunchAll"
      ],
      "conditions": [
        "Empty",
        "IntakeFull",
        "Tip",
        "LeftCellUp",
        "RightCellUp"
      ],
      "typicalS": {
        "SpinUp": 0.1,
        "LaunchAll": 2.0
      },
      "events": [
        "Tip"
      ]
    },
    "points": {
      "START": [
        55,
        9.7,
        90
      ],
      "S_CATCH": [
        57.5,
        21,
        90
      ],
      "GARDEN_IN": [
        9.5,
        20.56,
        270
      ],
      "GARDEN": [
        9.5,
        10.96,
        270
      ],
      "R_S": [
        40,
        22,
        90
      ],
      "R_N": [
        30,
        104,
        90
      ],
      "PARK": [
        14,
        95,
        90
      ],
      "WALL_FLOWER": [
        14.86,
        47.36,
        180
      ],
      "WALL_FLOWER_IN": [
        20.66,
        47.36,
        180
      ],
      "WALL_FLOWER_TURN": [
        23.16,
        47.36,
        180
      ],
      "R_PRE": [
        57,
        20,
        90
      ],
      "R_W": [
        30,
        40,
        90
      ]
    },
    "pathEnds": {
      "to-r-pre-1": "R_PRE",
      "to-s-catch-2": "S_CATCH",
      "to-garden-in-3": "GARDEN_IN",
      "to-garden-4": "GARDEN",
      "to-r-s-5": "R_S",
      "to-r-w-6": "R_W",
      "to-r-n-7": "R_N",
      "to-wall-flower-turn-8": "WALL_FLOWER_TURN",
      "to-wall-flower-9": "WALL_FLOWER",
      "to-r-n-10": "R_N",
      "to-wall-flower-turn-11": "WALL_FLOWER_TURN",
      "to-wall-flower-12": "WALL_FLOWER",
      "to-r-n-13": "R_N",
      "to-r-w-14": "R_W",
      "to-r-n-15": "R_N",
      "to-park-16": "PARK"
    },
    "startAt": "START",
    "cards": [
      {
        "id": "a-1",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "p-2",
        "kind": "path",
        "lineId": "to-r-pre-1",
        "park": false
      },
      {
        "id": "w-3",
        "kind": "firstOf",
        "label": "Preloads at the right CELL (TIP 1)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 3000,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-4",
        "kind": "path",
        "lineId": "to-s-catch-2",
        "park": false
      },
      {
        "id": "w-7",
        "kind": "firstOf",
        "label": "TIP 1",
        "rows": [
          {
            "when": [
              "Tip"
            ],
            "cards": []
          },
          {
            "afterMs": 4000,
            "cards": [
              {
                "id": "w-5",
                "kind": "firstOf",
                "label": "TIP 1 missed: catch",
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
                "id": "w-6",
                "kind": "firstOf",
                "label": "TIP 1 missed: fire the catch",
                "rows": [
                  {
                    "when": [
                      "Tip"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 3000,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          }
        ]
      },
      {
        "id": "w-8",
        "kind": "firstOf",
        "label": "Catch TIP 1's spill",
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
        "id": "w-33",
        "kind": "firstOf",
        "label": "TIP 2 (L): the right CELL up",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": [
              {
                "id": "w-9",
                "kind": "firstOf",
                "label": "TIP 1's catch at the right CELL",
                "rows": [
                  {
                    "when": [
                      "Empty"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              },
              {
                "id": "p-10",
                "kind": "path",
                "lineId": "to-garden-in-3",
                "park": false
              },
              {
                "id": "p-11",
                "kind": "path",
                "lineId": "to-garden-4",
                "park": false
              },
              {
                "id": "w-12",
                "kind": "firstOf",
                "label": "The GARDEN's 4",
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
                "id": "p-13",
                "kind": "path",
                "lineId": "to-r-s-5",
                "park": false
              },
              {
                "id": "w-27",
                "kind": "firstOf",
                "label": "The right CELL up",
                "rows": [
                  {
                    "when": [
                      "RightCellUp"
                    ],
                    "cards": [
                      {
                        "id": "w-22",
                        "kind": "firstOf",
                        "label": "The GARDEN's 4 (TIP 3)",
                        "rows": [
                          {
                            "when": [
                              "Tip"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 2500,
                            "cards": []
                          }
                        ],
                        "alongside": "LaunchAll"
                      },
                      {
                        "id": "p-23",
                        "kind": "path",
                        "lineId": "to-wall-flower-turn-11",
                        "park": false
                      },
                      {
                        "id": "p-24",
                        "kind": "path",
                        "lineId": "to-wall-flower-12",
                        "park": false
                      },
                      {
                        "id": "w-25",
                        "kind": "firstOf",
                        "label": "The wall FLOWER's 4",
                        "rows": [
                          {
                            "when": [
                              "IntakeFull"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 3000,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "p-26",
                        "kind": "path",
                        "lineId": "to-r-n-13",
                        "park": false
                      }
                    ]
                  },
                  {
                    "afterMs": 1500,
                    "cards": [
                      {
                        "id": "w-21",
                        "kind": "firstOf",
                        "label": "TIP 3 done?",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": [
                              {
                                "id": "p-14",
                                "kind": "path",
                                "lineId": "to-r-w-6",
                                "park": false
                              },
                              {
                                "id": "p-15",
                                "kind": "path",
                                "lineId": "to-r-n-7",
                                "park": false
                              }
                            ],
                            "label": "Yes: the GARDEN's 4 to TIP 4"
                          },
                          {
                            "afterMs": 50,
                            "cards": [
                              {
                                "id": "w-16",
                                "kind": "firstOf",
                                "label": "The GARDEN's 4 (TIP 3)",
                                "rows": [
                                  {
                                    "when": [
                                      "Tip"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 2500,
                                    "cards": []
                                  }
                                ],
                                "alongside": "LaunchAll"
                              },
                              {
                                "id": "p-17",
                                "kind": "path",
                                "lineId": "to-wall-flower-turn-8",
                                "park": false
                              },
                              {
                                "id": "p-18",
                                "kind": "path",
                                "lineId": "to-wall-flower-9",
                                "park": false
                              },
                              {
                                "id": "w-19",
                                "kind": "firstOf",
                                "label": "The wall FLOWER's 4",
                                "rows": [
                                  {
                                    "when": [
                                      "IntakeFull"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 3000,
                                    "cards": []
                                  }
                                ]
                              },
                              {
                                "id": "p-20",
                                "kind": "path",
                                "lineId": "to-r-n-10",
                                "park": false
                              }
                            ],
                            "label": "No: the GARDEN's 4 to TIP 3"
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                "id": "w-28",
                "kind": "firstOf",
                "label": "The left CELL up",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 4000,
                    "cards": []
                  }
                ]
              },
              {
                "id": "w-29",
                "kind": "firstOf",
                "label": "R's 4 at the left CELL (TIP 4, with L)",
                "rows": [
                  {
                    "when": [
                      "Empty"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          },
          {
            "afterMs": 9000,
            "cards": [
              {
                "id": "p-30",
                "kind": "path",
                "lineId": "to-r-w-14",
                "park": false
              },
              {
                "id": "p-31",
                "kind": "path",
                "lineId": "to-r-n-15",
                "park": false
              },
              {
                "id": "w-32",
                "kind": "firstOf",
                "label": "No TIP 2: TIP 1's catch at the left CELL (TIP 2)",
                "rows": [
                  {
                    "when": [
                      "Empty"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 3000,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          }
        ]
      },
      {
        "id": "p-34",
        "kind": "path",
        "lineId": "to-park-16",
        "park": true
      }
    ]
  },
  "version": "1.5.0"
}