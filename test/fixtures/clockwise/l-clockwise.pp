{
  "version": "2.0.0",
  "timestamp": "2026-11-12T22:32:03.306Z",
  "startPoint": {
    "x": 62.3,
    "y": 133.8,
    "locked": false,
    "headingDeg": 270
  },
  "lines": [
    {
      "id": "l-open",
      "color": "#4e79a7",
      "name": "open to LEFT_WALL_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 133.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-catch-park",
      "color": "#4e79a7",
      "name": "catch park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [
        {
          "x": 59,
          "y": 121
        },
        {
          "x": 40,
          "y": 117.4
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
                "startDeg": 270,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 360
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 133.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-rescue",
      "color": "#4e79a7",
      "name": "under the HIVE to RIGHT_START",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-rescue-south",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 58.3,
            "y": 42
          },
          "controlPoints": [
            {
              "x": 58.76832619047272,
              "y": 101.56857289931824
            },
            {
              "x": 65.20046354104544,
              "y": 71.90515781237575
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        },
        {
          "id": "l-rescue-turn",
          "color": "#e15759",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 56.5,
            "y": 24
          },
          "controlPoints": [],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 90
          }
        },
        {
          "id": "l-rescue-aim",
          "color": "#4e79a7",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
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
        }
      ]
    },
    {
      "id": "l-rescue-park",
      "color": "#4e79a7",
      "name": "right catch park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-rescue-park-clear",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 50,
            "y": 38
          },
          "controlPoints": [
            {
              "x": 55.6,
              "y": 28
            },
            {
              "x": 56,
              "y": 38
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 90
          }
        },
        {
          "id": "l-rescue-park-west",
          "color": "#e15759",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 38
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 90
          }
        },
        {
          "id": "l-rescue-park-lane",
          "color": "#4e79a7",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 106
          },
          "controlPoints": [
            {
              "x": 31,
              "y": 40
            },
            {
              "x": 33,
              "y": 92
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 90
          }
        },
        {
          "id": "l-rescue-park-turn-face",
          "color": "#edc948",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 118.2
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 112
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        },
        {
          "id": "l-rescue-park-turn",
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
            "y": 117.4
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
          }
        }
      ]
    },
    {
      "id": "link-2",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 133.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-pickup-garden",
      "color": "#4e79a7",
      "name": "under the HIVE to GARDEN_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-under-hive-garden",
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
            "y": 26
          },
          "controlPoints": [
            {
              "x": 58.76832619047272,
              "y": 101.56857289931824
            },
            {
              "x": 65.20046354104544,
              "y": 71.90515781237575
            },
            {
              "x": 60.600162310030015,
              "y": 40.90098343477904
            }
          ],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        },
        {
          "id": "l-to-garden-garden",
          "color": "#e15759",
          "name": "",
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
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 270
          }
        }
      ]
    },
    {
      "id": "l-pickup-park-garden",
      "color": "#4e79a7",
      "name": "GARDEN park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-pickup-park-lane-garden",
          "color": "#edc948",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 106
          },
          "controlPoints": [
            {
              "x": 31,
              "y": 38
            },
            {
              "x": 33,
              "y": 92
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 90
          }
        },
        {
          "id": "l-pickup-park-turn-garden-face",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 118.2
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 112
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        },
        {
          "id": "l-pickup-park-turn-garden",
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
            "y": 117.4
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
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
      "id": "l-to-offset-garden",
      "color": "#4e79a7",
      "name": "GARDEN to RIGHT_WALL_NEAR",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 35.9,
        "y": 10.6
      },
      "controlPoints": [
        {
          "x": 21,
          "y": 14
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 426.9
      }
    },
    {
      "id": "l-park",
      "color": "#4e79a7",
      "name": "outside lane to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-park-lane",
          "color": "#76b7b2",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 106
          },
          "controlPoints": [
            {
              "x": 25,
              "y": 20
            },
            {
              "x": 35,
              "y": 92
            }
          ],
          "heading": {
            "type": "piecewise",
            "piecewiseHeading": {
              "segments": [
                {
                  "startProgress": 0,
                  "endProgress": 0.2,
                  "interpolationType": "linear",
                  "parameters": {
                    "startDeg": 66.9,
                    "endDeg": 90
                  }
                },
                {
                  "startProgress": 0.2,
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
          "id": "l-park-turn-face",
          "color": "#4e79a7",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 118.2
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 112
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        },
        {
          "id": "l-park-turn",
          "color": "#e15759",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 14.5,
            "y": 117.4
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
          }
        }
      ]
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 133.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-under-flower",
      "color": "#4e79a7",
      "name": "under the HIVE to the lane's end",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60.5,
        "y": 34
      },
      "controlPoints": [
        {
          "x": 58.76832619047272,
          "y": 101.56857289931824
        },
        {
          "x": 65.20046354104544,
          "y": 71.90515781237575
        }
      ],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-under-park-flower",
      "color": "#4e79a7",
      "name": "lane's end park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-under-park-lane-flower",
          "color": "#76b7b2",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 106
          },
          "controlPoints": [
            {
              "x": 33,
              "y": 40
            },
            {
              "x": 33,
              "y": 92
            }
          ],
          "heading": {
            "type": "piecewise",
            "piecewiseHeading": {
              "segments": [
                {
                  "startProgress": 0,
                  "endProgress": 0.3,
                  "interpolationType": "linear",
                  "parameters": {
                    "startDeg": 270,
                    "endDeg": 90
                  }
                },
                {
                  "startProgress": 0.3,
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
          "id": "l-under-park-turn-flower-face",
          "color": "#9c755f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 118.2
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 112
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        },
        {
          "id": "l-under-park-turn-flower",
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
            "y": 117.4
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
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
        "x": 60.5,
        "y": 34
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-pickup-flower",
      "color": "#4e79a7",
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
      "controlPoints": [
        {
          "x": 52,
          "y": 38
        },
        {
          "x": 36,
          "y": 38
        },
        {
          "x": 33,
          "y": 47.2
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.5,
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
      "id": "l-pickup-park-flower",
      "color": "#4e79a7",
      "name": "FLOWER park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "l-pickup-park-lane-flower",
          "color": "#59a14f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 34,
            "y": 106
          },
          "controlPoints": [
            {
              "x": 32,
              "y": 62
            },
            {
              "x": 33,
              "y": 92
            }
          ],
          "heading": {
            "type": "piecewise",
            "piecewiseHeading": {
              "segments": [
                {
                  "startProgress": 0,
                  "endProgress": 0.25,
                  "interpolationType": "linear",
                  "parameters": {
                    "startDeg": 180,
                    "endDeg": 90
                  }
                },
                {
                  "startProgress": 0.25,
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
          "id": "l-pickup-park-turn-flower-face",
          "color": "#59a14f",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 36,
            "y": 118.2
          },
          "controlPoints": [
            {
              "x": 35,
              "y": 112
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        },
        {
          "id": "l-pickup-park-turn-flower",
          "color": "#e15759",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 14.5,
            "y": 117.4
          },
          "controlPoints": [],
          "heading": {
            "type": "constant",
            "degrees": 0
          }
        }
      ]
    },
    {
      "id": "link-6",
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
      "id": "l-to-offset-flower",
      "color": "#4e79a7",
      "name": "FLOWER to RIGHT_WALL_NEAR",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 35.9,
        "y": 10.6
      },
      "controlPoints": [
        {
          "x": 28,
          "y": 38
        },
        {
          "x": 32,
          "y": 20
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 66.9
      }
    }
  ],
  "shapes": [],
  "sequence": [
    {
      "kind": "path",
      "lineId": "l-open"
    },
    {
      "kind": "path",
      "lineId": "l-catch-park"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-south"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-turn"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-aim"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park-clear"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park-west"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park-lane"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park-turn-face"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park-turn"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "l-under-hive-garden"
    },
    {
      "kind": "path",
      "lineId": "l-to-garden-garden"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-lane-garden"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-turn-garden-face"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-turn-garden"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "l-to-offset-garden"
    },
    {
      "kind": "path",
      "lineId": "l-park-lane"
    },
    {
      "kind": "path",
      "lineId": "l-park-turn-face"
    },
    {
      "kind": "path",
      "lineId": "l-park-turn"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "l-under-flower"
    },
    {
      "kind": "path",
      "lineId": "l-under-park-lane-flower"
    },
    {
      "kind": "path",
      "lineId": "l-under-park-turn-flower-face"
    },
    {
      "kind": "path",
      "lineId": "l-under-park-turn-flower"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-flower"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-lane-flower"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-turn-flower-face"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-turn-flower"
    },
    {
      "kind": "path",
      "lineId": "link-6"
    },
    {
      "kind": "path",
      "lineId": "l-to-offset-flower"
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
      "LEFT_START": [
        62.3,
        133.8,
        270
      ],
      "LEFT_WALL_HIVE": [
        59.9,
        133.4,
        270
      ],
      "RIGHT_START": [
        55.6,
        7.7,
        90
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "WALL_FLOWER_STAGING": [
        23.1,
        47.2,
        180
      ],
      "RIGHT_WALL_NEAR": [
        35.9,
        10.6,
        66.9
      ],
      "LEFT_PARK": [
        14.5,
        117.4,
        0
      ]
    },
    "pathEnds": {
      "l-open": "LEFT_WALL_HIVE",
      "l-catch-park": "LEFT_PARK",
      "l-rescue-aim": "RIGHT_START",
      "l-rescue-park-turn": "LEFT_PARK",
      "l-to-garden-garden": "GARDEN_STAGING",
      "l-to-offset-garden": "RIGHT_WALL_NEAR",
      "l-pickup-park-turn-garden": "LEFT_PARK",
      "l-under-park-turn-flower": "LEFT_PARK",
      "l-pickup-flower": "WALL_FLOWER_STAGING",
      "l-to-offset-flower": "RIGHT_WALL_NEAR",
      "l-pickup-park-turn-flower": "LEFT_PARK",
      "l-park-turn": "LEFT_PARK"
    },
    "cards": [
      {
        "id": "l-spin",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "l-c-open",
        "kind": "path",
        "lineId": "l-open",
        "park": false
      },
      {
        "id": "l-stop-1",
        "kind": "firstOf",
        "label": "L1: LEFT up by 9.5 s, otherwise cross and finish TIP 1 at RIGHT",
        "rows": [
          {
            "afterMs": 9500,
            "matchClock": true,
            "option": "T1 LEFT up by",
            "cards": [
              {
                "id": "l-c-rescue",
                "kind": "path",
                "lineId": "l-rescue",
                "park": false
              },
              {
                "id": "l-launch-rescue",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "l-hold-rescue",
                "kind": "firstOf",
                "label": "R has parked from the left spot: park at 22.5 s",
                "rows": [
                  {
                    "afterMs": 22500,
                    "matchClock": true,
                    "option": "TLr park after the crossing at",
                    "cards": []
                  }
                ]
              },
              {
                "id": "l-c-rescue-park",
                "kind": "path",
                "lineId": "l-rescue-park",
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
                "id": "l-launch-left",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "l-pickup",
                "kind": "firstOf",
                "label": "Pickup: GARDEN or WALL_FLOWER",
                "rows": [
                  {
                    "when": [
                      "Pickup"
                    ],
                    "label": "GARDEN",
                    "cards": [
                      {
                        "id": "l-c-pickup-garden",
                        "kind": "path",
                        "lineId": "l-pickup-garden",
                        "park": false
                      },
                      {
                        "id": "l-grab-garden",
                        "kind": "action",
                        "name": "GardenGather",
                        "timeoutS": 5.5
                      },
                      {
                        "id": "l-c-offset-garden",
                        "kind": "path",
                        "lineId": "l-to-offset-garden",
                        "park": false
                      }
                    ]
                  },
                  {
                    "afterMs": 0,
                    "label": "WALL_FLOWER",
                    "cards": [
                      {
                        "id": "l-c-under-flower",
                        "kind": "path",
                        "lineId": "l-under-flower",
                        "park": false
                      },
                      {
                        "id": "l-hold-flower",
                        "kind": "firstOf",
                        "label": "R has passed the FLOWER: go at 15.5 s",
                        "rows": [
                          {
                            "afterMs": 15500,
                            "matchClock": true,
                            "option": "TF FLOWER at",
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-pickup-flower",
                        "kind": "path",
                        "lineId": "l-pickup-flower",
                        "park": false
                      },
                      {
                        "id": "l-grab-flower",
                        "kind": "action",
                        "name": "PickFlower",
                        "timeoutS": 4.5
                      },
                      {
                        "id": "l-c-offset-flower",
                        "kind": "path",
                        "lineId": "l-to-offset-flower",
                        "park": false
                      }
                    ]
                  }
                ],
                "choice": "Pickup"
              },
              {
                "id": "l-stop-2",
                "kind": "firstOf",
                "label": "L2: RIGHT up by 20.6 s, otherwise keep the load",
                "rows": [
                  {
                    "afterMs": 20600,
                    "matchClock": true,
                    "option": "T4 RIGHT up by",
                    "cards": [
                      {
                        "id": "l-hold-no",
                        "kind": "firstOf",
                        "label": "R has left the scoring FLOWER: park at 22.7 s",
                        "rows": [
                          {
                            "afterMs": 22700,
                            "matchClock": true,
                            "option": "TL park at",
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-park-no",
                        "kind": "path",
                        "lineId": "l-park",
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
                        "id": "l-launch-right",
                        "kind": "action",
                        "name": "LaunchAll",
                        "timeoutS": 1
                      },
                      {
                        "id": "l-hold-yes",
                        "kind": "firstOf",
                        "label": "R has left the scoring FLOWER: park at 22.7 s",
                        "rows": [
                          {
                            "afterMs": 22700,
                            "matchClock": true,
                            "option": "TL park at",
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-park",
                        "kind": "path",
                        "lineId": "l-park",
                        "park": true
                      }
                    ]
                  }
                ],
                "shot": true
              }
            ]
          }
        ],
        "shot": true
      }
    ],
    "startAt": "LEFT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4",
      "link-5",
      "link-6"
    ],
    "parkFrom": {
      "l-c-offset-garden": "l-park",
      "l-c-pickup-garden": "l-pickup-park-garden",
      "l-c-under-flower": "l-under-park-flower",
      "l-c-offset-flower": "l-park",
      "l-c-pickup-flower": "l-pickup-park-flower",
      "l-c-open": "l-catch-park"
    },
    "partner": {
      "auto": "R-Clockwise",
      "follows": "Pickup",
      "settings": [
        "WALL_FLOWER",
        "GARDEN"
      ]
    },
    "exportName": "L-Clockwise"
  }
}