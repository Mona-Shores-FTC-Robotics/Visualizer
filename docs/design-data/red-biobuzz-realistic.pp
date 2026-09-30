{
  "startPoint": {
    "x": 60.0,
    "y": 9.0,
    "headingDeg": 90,
    "name": "Start"
  },
  "lines": [
    {
      "id": "start-to-flower",
      "color": "#3fcf8e",
      "name": "StartToFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 47.0,
        "y": 125.5
      },
      "controlPoints": [
        {
          "x": 60.0,
          "y": 124.0
        },
        {
          "x": 60.0,
          "y": 127.0
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
      "id": "flower-to-shot",
      "color": "#ffc516",
      "name": "FlowerToLoadingShot",
      "kind": "atomic",
      "endPoint": {
        "x": 38.0,
        "y": 112.0
      },
      "controlPoints": [
        {
          "x": 46.0,
          "y": 116.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.35,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.35,
              "endProgress": 1.0,
              "interpolationType": "facing-point",
              "parameters": {
                "point": {
                  "x": 57.9,
                  "y": 86.9
                }
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
      "id": "shot-to-park",
      "color": "#e5484d",
      "name": "ShotToPark",
      "kind": "atomic",
      "endPoint": {
        "x": 16.0,
        "y": 106.0
      },
      "controlPoints": [
        {
          "x": 26.0,
          "y": 112.0
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 308,
        "endDeg": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "link-park-shot",
      "color": "#6b7280",
      "name": "Link to LoadingShot (never driven)",
      "kind": "atomic",
      "endPoint": {
        "x": 38.0,
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
      "id": "shot-to-garden-flower",
      "color": "#5fd4e6",
      "name": "ShotToGardenFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 16.5,
        "y": 47.5
      },
      "controlPoints": [
        {
          "x": 30.0,
          "y": 96.0
        },
        {
          "x": 26.0,
          "y": 50.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.7,
              "interpolationType": "tangential"
            },
            {
              "startProgress": 0.7,
              "endProgress": 1.0,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 180
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
      "id": "garden-flower-to-west-shot",
      "color": "#ffc516",
      "name": "GardenFlowerToWestShot",
      "kind": "atomic",
      "endPoint": {
        "x": 30.0,
        "y": 80.0
      },
      "controlPoints": [
        {
          "x": 26.0,
          "y": 60.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 1.0,
              "interpolationType": "facing-point",
              "parameters": {
                "point": {
                  "x": 57.9,
                  "y": 86.9
                }
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
      "id": "west-shot-to-park",
      "color": "#e5484d",
      "name": "WestShotToPark",
      "kind": "atomic",
      "endPoint": {
        "x": 16.0,
        "y": 106.0
      },
      "controlPoints": [
        {
          "x": 22.0,
          "y": 96.0
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 14,
        "endDeg": 90
      },
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": ""
    },
    {
      "id": "link-park-start",
      "color": "#6b7280",
      "name": "Link to Start (never driven)",
      "kind": "atomic",
      "endPoint": {
        "x": 60.0,
        "y": 9.0
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
      "id": "garden-sweep",
      "color": "#ff8a3d",
      "name": "GardenSweep",
      "kind": "atomic",
      "endPoint": {
        "x": 20.0,
        "y": 10.0
      },
      "controlPoints": [
        {
          "x": 52.0,
          "y": 30.0
        },
        {
          "x": 36.0,
          "y": 10.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1.0,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
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
      "id": "garden-to-shot",
      "color": "#ffc516",
      "name": "GardenToShot",
      "kind": "atomic",
      "endPoint": {
        "x": 36.0,
        "y": 30.0
      },
      "controlPoints": [
        {
          "x": 28.0,
          "y": 20.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 1.0,
              "interpolationType": "facing-point",
              "parameters": {
                "point": {
                  "x": 57.9,
                  "y": 60.3
                }
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
      "id": "garden-shot-to-flower",
      "color": "#ff8a3d",
      "name": "GardenShotToFlower",
      "kind": "atomic",
      "endPoint": {
        "x": 47.0,
        "y": 125.5
      },
      "controlPoints": [
        {
          "x": 30.0,
          "y": 60.0
        },
        {
          "x": 30.0,
          "y": 112.0
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.75,
              "interpolationType": "tangential"
            },
            {
              "startProgress": 0.75,
              "endProgress": 1.0,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 60,
                "endDeg": 90
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
      "id": "link-flower-garden-shot",
      "color": "#6b7280",
      "name": "Link to GardenShot (never driven)",
      "kind": "atomic",
      "endPoint": {
        "x": 36.0,
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
      "id": "retry-park",
      "color": "#e5484d",
      "name": "RetryPark",
      "kind": "atomic",
      "endPoint": {
        "x": 16.0,
        "y": 106.0
      },
      "controlPoints": [
        {
          "x": 28.0,
          "y": 70.0
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
      "lineId": "start-to-flower"
    },
    {
      "kind": "path",
      "lineId": "flower-to-shot"
    },
    {
      "kind": "path",
      "lineId": "shot-to-park"
    },
    {
      "kind": "path",
      "lineId": "link-park-shot"
    },
    {
      "kind": "path",
      "lineId": "shot-to-garden-flower"
    },
    {
      "kind": "path",
      "lineId": "garden-flower-to-west-shot"
    },
    {
      "kind": "path",
      "lineId": "west-shot-to-park"
    },
    {
      "kind": "path",
      "lineId": "link-park-start"
    },
    {
      "kind": "path",
      "lineId": "garden-sweep"
    },
    {
      "kind": "path",
      "lineId": "garden-to-shot"
    },
    {
      "kind": "path",
      "lineId": "garden-shot-to-flower"
    },
    {
      "kind": "path",
      "lineId": "link-flower-garden-shot"
    },
    {
      "kind": "path",
      "lineId": "retry-park"
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
    "maxVelocity": 40,
    "maxAcceleration": 30,
    "maxDeceleration": 30,
    "fieldMap": "biobuzz.webp"
  },
  "version": "1.5.0",
  "timestamp": "2026-09-30T12:00:00.000Z",
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [
        "LaunchAll",
        "IntakeOn"
      ],
      "conditions": [
        "RightCellDown",
        "LeftCellDown",
        "IntakeFull"
      ],
      "typicalS": {
        "LaunchAll": 3.0,
        "IntakeOn": 0.2
      }
    },
    "points": {
      "Start": [
        60.0,
        9.0,
        90
      ],
      "LoadingFlower": [
        47.0,
        125.5,
        90
      ],
      "LoadingShot": [
        38.0,
        112.0,
        308
      ],
      "Park": [
        16.0,
        106.0,
        90
      ],
      "GardenFlower": [
        16.5,
        47.5,
        180
      ],
      "WestShot": [
        30.0,
        80.0,
        14
      ],
      "GardenPickup": [
        20.0,
        10.0,
        180
      ],
      "GardenShot": [
        36.0,
        30.0,
        54
      ]
    },
    "pathEnds": {
      "start-to-flower": "LoadingFlower",
      "flower-to-shot": "LoadingShot",
      "shot-to-park": "Park",
      "link-park-shot": "LoadingShot",
      "shot-to-garden-flower": "GardenFlower",
      "garden-flower-to-west-shot": "WestShot",
      "west-shot-to-park": "Park",
      "link-park-start": "Start",
      "garden-sweep": "GardenPickup",
      "garden-to-shot": "GardenShot",
      "garden-shot-to-flower": "LoadingFlower",
      "link-flower-garden-shot": "GardenShot",
      "retry-park": "Park"
    },
    "routines": {},
    "cards": [
      {
        "id": "cmd-1",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "decide-35",
        "kind": "firstOf",
        "label": "Did the HIVE tip?",
        "rows": [
          {
            "when": [
              "RightCellDown"
            ],
            "label": "Tipped: to the LOADING side",
            "cards": [
              {
                "id": "path-2",
                "kind": "path",
                "lineId": "start-to-flower",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "cmd-3",
                "kind": "action",
                "name": "IntakeOn",
                "timeoutS": 1.0
              },
              {
                "id": "wait-4",
                "kind": "firstOf",
                "label": "Collect at the LOADING FLOWER",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ]
              },
              {
                "id": "path-5",
                "kind": "path",
                "lineId": "flower-to-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "cmd-6",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "decide-14",
                "kind": "firstOf",
                "label": "Did the HIVE tip back?",
                "rows": [
                  {
                    "when": [
                      "LeftCellDown"
                    ],
                    "label": "Tipped back: park",
                    "cards": [
                      {
                        "id": "path-7",
                        "kind": "path",
                        "lineId": "shot-to-park",
                        "while": [],
                        "events": [],
                        "park": true
                      }
                    ]
                  },
                  {
                    "afterMs": 3000,
                    "label": "Not tipped back: second FLOWER",
                    "cards": [
                      {
                        "id": "path-8",
                        "kind": "path",
                        "lineId": "shot-to-garden-flower",
                        "while": [],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "cmd-9",
                        "kind": "action",
                        "name": "IntakeOn",
                        "timeoutS": 1.0
                      },
                      {
                        "id": "wait-10",
                        "kind": "firstOf",
                        "label": "Collect at the GARDEN FLOWER",
                        "rows": [
                          {
                            "when": [
                              "IntakeFull"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 2000,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "path-11",
                        "kind": "path",
                        "lineId": "garden-flower-to-west-shot",
                        "while": [],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "cmd-12",
                        "kind": "action",
                        "name": "LaunchAll"
                      },
                      {
                        "id": "path-13",
                        "kind": "path",
                        "lineId": "west-shot-to-park",
                        "while": [],
                        "events": [],
                        "park": true
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "afterMs": 3000,
            "label": "Not tipped: collect the GARDEN",
            "cards": [
              {
                "id": "cmd-15",
                "kind": "action",
                "name": "IntakeOn",
                "timeoutS": 1.0
              },
              {
                "id": "path-16",
                "kind": "path",
                "lineId": "garden-sweep",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "wait-17",
                "kind": "firstOf",
                "label": "Collect the GARDEN POLLEN",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ]
              },
              {
                "id": "path-18",
                "kind": "path",
                "lineId": "garden-to-shot",
                "while": [],
                "events": [],
                "park": false
              },
              {
                "id": "cmd-19",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "decide-34",
                "kind": "firstOf",
                "label": "Did it tip this time?",
                "rows": [
                  {
                    "when": [
                      "RightCellDown"
                    ],
                    "label": "Tipped on the retry: rejoin",
                    "cards": [
                      {
                        "id": "path-20",
                        "kind": "path",
                        "lineId": "garden-shot-to-flower",
                        "while": [],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "cmd-21",
                        "kind": "action",
                        "name": "IntakeOn",
                        "timeoutS": 1.0
                      },
                      {
                        "id": "wait-22",
                        "kind": "firstOf",
                        "label": "Collect at the LOADING FLOWER",
                        "rows": [
                          {
                            "when": [
                              "IntakeFull"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 2000,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "path-23",
                        "kind": "path",
                        "lineId": "flower-to-shot",
                        "while": [],
                        "events": [],
                        "park": false
                      },
                      {
                        "id": "cmd-24",
                        "kind": "action",
                        "name": "LaunchAll"
                      },
                      {
                        "id": "decide-32",
                        "kind": "firstOf",
                        "label": "Did the HIVE tip back?",
                        "rows": [
                          {
                            "when": [
                              "LeftCellDown"
                            ],
                            "label": "Tipped back: park",
                            "cards": [
                              {
                                "id": "path-25",
                                "kind": "path",
                                "lineId": "shot-to-park",
                                "while": [],
                                "events": [],
                                "park": true
                              }
                            ]
                          },
                          {
                            "afterMs": 3000,
                            "label": "Not tipped back: second FLOWER",
                            "cards": [
                              {
                                "id": "path-26",
                                "kind": "path",
                                "lineId": "shot-to-garden-flower",
                                "while": [],
                                "events": [],
                                "park": false
                              },
                              {
                                "id": "cmd-27",
                                "kind": "action",
                                "name": "IntakeOn",
                                "timeoutS": 1.0
                              },
                              {
                                "id": "wait-28",
                                "kind": "firstOf",
                                "label": "Collect at the GARDEN FLOWER",
                                "rows": [
                                  {
                                    "when": [
                                      "IntakeFull"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 2000,
                                    "cards": []
                                  }
                                ]
                              },
                              {
                                "id": "path-29",
                                "kind": "path",
                                "lineId": "garden-flower-to-west-shot",
                                "while": [],
                                "events": [],
                                "park": false
                              },
                              {
                                "id": "cmd-30",
                                "kind": "action",
                                "name": "LaunchAll"
                              },
                              {
                                "id": "path-31",
                                "kind": "path",
                                "lineId": "west-shot-to-park",
                                "while": [],
                                "events": [],
                                "park": true
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "afterMs": 3000,
                    "label": "Still not tipped: park",
                    "cards": [
                      {
                        "id": "path-33",
                        "kind": "path",
                        "lineId": "retry-park",
                        "while": [],
                        "events": [],
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
    ],
    "startAt": "Start",
    "exportName": "red-biobuzz-realistic"
  }
}
