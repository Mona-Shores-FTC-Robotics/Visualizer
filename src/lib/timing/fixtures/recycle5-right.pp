{
  "startPoint": {
    "x": 61,
    "y": 9.5,
    "name": "START",
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "to-catch-1",
      "color": "#3cc8e4",
      "name": "START to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 93.7
      }
    },
    {
      "id": "to-look-2",
      "color": "#3cc8e4",
      "name": "CATCH to LOOK",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 54,
        "y": 17
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.55,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 0.95,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 93.7,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.95,
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
      "id": "to-catch-a-3",
      "color": "#3cc8e4",
      "name": "LOOK to CATCH_A",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 11.5
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
                "degrees": 180
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 91.3
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 91.3
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-catch-4",
      "color": "#3cc8e4",
      "name": "CATCH_A to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 93.7
      }
    },
    {
      "id": "to-garden-in-5",
      "color": "#3cc8e4",
      "name": "CATCH to GARDEN_IN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 8.5,
        "y": 22
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 10
        },
        {
          "x": 26,
          "y": 16
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.45,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            },
            {
              "startProgress": 0.45,
              "endProgress": 0.85,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 93.7,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.85,
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
      "id": "to-garden-6",
      "color": "#3cc8e4",
      "name": "GARDEN_IN to GARDEN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 8.5,
        "y": 11
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 270
      }
    },
    {
      "id": "to-catch-7",
      "color": "#3cc8e4",
      "name": "GARDEN to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 24,
          "y": 10
        },
        {
          "x": 44,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-onto-8",
      "color": "#3cc8e4",
      "name": "CATCH to ONTO",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60.8,
        "y": 13.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 93.7
      }
    },
    {
      "id": "to-collect-9",
      "color": "#3cc8e4",
      "name": "ONTO to COLLECT",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60.6,
        "y": 16.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 93.7
      }
    },
    {
      "id": "to-catch-10",
      "color": "#3cc8e4",
      "name": "COLLECT to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 93.7
      }
    },
    {
      "id": "to-sweep-0-11",
      "color": "#3cc8e4",
      "name": "CATCH to SWEEP_0",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 20,
        "y": 10
      },
      "controlPoints": [
        {
          "x": 48,
          "y": 26
        },
        {
          "x": 24,
          "y": 30
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
                "degrees": 93.7
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 93.7,
                "endDeg": 0
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-1-12",
      "color": "#3cc8e4",
      "name": "SWEEP_0 to SWEEP_1",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-13",
      "color": "#3cc8e4",
      "name": "SWEEP_1 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-2-14",
      "color": "#3cc8e4",
      "name": "SWEEP_1 to SWEEP_2",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 36,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-15",
      "color": "#3cc8e4",
      "name": "SWEEP_2 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-3-16",
      "color": "#3cc8e4",
      "name": "SWEEP_2 to SWEEP_3",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 42,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-17",
      "color": "#3cc8e4",
      "name": "SWEEP_3 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-4-18",
      "color": "#3cc8e4",
      "name": "SWEEP_3 to SWEEP_4",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 48,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-19",
      "color": "#3cc8e4",
      "name": "SWEEP_4 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-5-20",
      "color": "#3cc8e4",
      "name": "SWEEP_4 to SWEEP_5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 54,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-21",
      "color": "#3cc8e4",
      "name": "SWEEP_5 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-6-22",
      "color": "#3cc8e4",
      "name": "SWEEP_5 to SWEEP_6",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.5,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-catch-23",
      "color": "#3cc8e4",
      "name": "SWEEP_6 to CATCH",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61,
        "y": 10.5
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 10
        },
        {
          "x": 48,
          "y": 10
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.55,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 93.7
              }
            },
            {
              "startProgress": 0.55,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-stage-24",
      "color": "#3cc8e4",
      "name": "CATCH to WALL_STAGE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 13.6
      },
      "controlPoints": [
        {
          "x": 50,
          "y": 16
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.35,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 93.7
              }
            },
            {
              "startProgress": 0.35,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 93.7,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.9,
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
      "id": "to-look5-25",
      "color": "#3cc8e4",
      "name": "WALL_STAGE to LOOK5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 40,
        "y": 26
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
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
      "id": "to-hold5-26",
      "color": "#3cc8e4",
      "name": "LOOK5 to HOLD5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 24,
        "y": 18
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 48.8
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 48.8
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-0-27",
      "color": "#3cc8e4",
      "name": "HOLD5 to SWEEP_0",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 20,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.7,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 48.8,
                "endDeg": 0
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-1-28",
      "color": "#3cc8e4",
      "name": "SWEEP_0 to SWEEP_1",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-29",
      "color": "#3cc8e4",
      "name": "SWEEP_1 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-2-30",
      "color": "#3cc8e4",
      "name": "SWEEP_1 to SWEEP_2",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 36,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-31",
      "color": "#3cc8e4",
      "name": "SWEEP_2 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 36,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-3-32",
      "color": "#3cc8e4",
      "name": "SWEEP_2 to SWEEP_3",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 42,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-33",
      "color": "#3cc8e4",
      "name": "SWEEP_3 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 42,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-4-34",
      "color": "#3cc8e4",
      "name": "SWEEP_3 to SWEEP_4",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 48,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-35",
      "color": "#3cc8e4",
      "name": "SWEEP_4 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 48,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-5-36",
      "color": "#3cc8e4",
      "name": "SWEEP_4 to SWEEP_5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 54,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-37",
      "color": "#3cc8e4",
      "name": "SWEEP_5 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 50,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-sweep-6-38",
      "color": "#3cc8e4",
      "name": "SWEEP_5 to SWEEP_6",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.5,
        "y": 10
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 0
      }
    },
    {
      "id": "to-shoot5-39",
      "color": "#3cc8e4",
      "name": "SWEEP_6 to SHOOT5",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 17
      },
      "controlPoints": [
        {
          "x": 50,
          "y": 13
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 78.6
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 78.6
              }
            }
          ]
        }
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
      "lineId": "to-catch-1"
    },
    {
      "kind": "path",
      "lineId": "to-look-2"
    },
    {
      "kind": "path",
      "lineId": "to-catch-a-3"
    },
    {
      "kind": "path",
      "lineId": "to-catch-4"
    },
    {
      "kind": "path",
      "lineId": "to-garden-in-5"
    },
    {
      "kind": "path",
      "lineId": "to-garden-6"
    },
    {
      "kind": "path",
      "lineId": "to-catch-7"
    },
    {
      "kind": "path",
      "lineId": "to-onto-8"
    },
    {
      "kind": "path",
      "lineId": "to-collect-9"
    },
    {
      "kind": "path",
      "lineId": "to-catch-10"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-0-11"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-1-12"
    },
    {
      "kind": "path",
      "lineId": "to-catch-13"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-2-14"
    },
    {
      "kind": "path",
      "lineId": "to-catch-15"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-3-16"
    },
    {
      "kind": "path",
      "lineId": "to-catch-17"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-4-18"
    },
    {
      "kind": "path",
      "lineId": "to-catch-19"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-5-20"
    },
    {
      "kind": "path",
      "lineId": "to-catch-21"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-6-22"
    },
    {
      "kind": "path",
      "lineId": "to-catch-23"
    },
    {
      "kind": "path",
      "lineId": "to-wall-stage-24"
    },
    {
      "kind": "path",
      "lineId": "to-look5-25"
    },
    {
      "kind": "path",
      "lineId": "to-hold5-26"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-0-27"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-1-28"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-29"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-2-30"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-31"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-3-32"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-33"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-4-34"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-35"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-5-36"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-37"
    },
    {
      "kind": "path",
      "lineId": "to-sweep-6-38"
    },
    {
      "kind": "path",
      "lineId": "to-shoot5-39"
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
    "exportName": "recycle5-right",
    "registry": {
      "actions": [
        "LaunchAll",
        "CollectSeen",
        "SetDown",
        "IntakeOn"
      ],
      "conditions": [
        "Empty",
        "Tip",
        "IntakeFull",
        "RightCellUp",
        "LeftCellUp"
      ],
      "typicalS": {
        "LaunchAll": 2.0,
        "CollectSeen": 2.0,
        "SetDown": 1.0,
        "IntakeOn": 0.1
      },
      "events": [
        "Tip"
      ]
    },
    "points": {
      "START": [
        61,
        9.5,
        90
      ],
      "GARDEN_IN": [
        8.5,
        22,
        270
      ],
      "GARDEN": [
        8.5,
        11,
        270
      ],
      "CATCH": [
        61,
        10.5,
        93.7
      ],
      "CATCH_A": [
        59,
        11.5,
        91.3
      ],
      "ONTO": [
        60.8,
        13.5,
        93.7
      ],
      "COLLECT": [
        60.6,
        16.5,
        93.7
      ],
      "SWEEP_0": [
        20,
        10,
        0
      ],
      "SWEEP_1": [
        30,
        10,
        0
      ],
      "SWEEP_2": [
        36,
        10,
        0
      ],
      "SWEEP_3": [
        42,
        10,
        0
      ],
      "SWEEP_4": [
        48,
        10,
        0
      ],
      "SWEEP_5": [
        54,
        10,
        0
      ],
      "SWEEP_6": [
        59.5,
        10,
        0
      ],
      "LOOK": [
        54,
        17,
        180
      ],
      "WALL_STAGE": [
        40,
        13.6,
        270
      ],
      "LOOK5": [
        40,
        26,
        90
      ],
      "HOLD5": [
        24,
        18,
        48.8
      ],
      "SHOOT5": [
        50,
        17,
        78.6
      ]
    },
    "pathEnds": {
      "to-catch-1": "CATCH",
      "to-look-2": "LOOK",
      "to-catch-a-3": "CATCH_A",
      "to-catch-4": "CATCH",
      "to-garden-in-5": "GARDEN_IN",
      "to-garden-6": "GARDEN",
      "to-catch-7": "CATCH",
      "to-onto-8": "ONTO",
      "to-collect-9": "COLLECT",
      "to-catch-10": "CATCH",
      "to-sweep-0-11": "SWEEP_0",
      "to-sweep-1-12": "SWEEP_1",
      "to-catch-13": "CATCH",
      "to-sweep-2-14": "SWEEP_2",
      "to-catch-15": "CATCH",
      "to-sweep-3-16": "SWEEP_3",
      "to-catch-17": "CATCH",
      "to-sweep-4-18": "SWEEP_4",
      "to-catch-19": "CATCH",
      "to-sweep-5-20": "SWEEP_5",
      "to-catch-21": "CATCH",
      "to-sweep-6-22": "SWEEP_6",
      "to-catch-23": "CATCH",
      "to-wall-stage-24": "WALL_STAGE",
      "to-look5-25": "LOOK5",
      "to-hold5-26": "HOLD5",
      "to-sweep-0-27": "SWEEP_0",
      "to-sweep-1-28": "SWEEP_1",
      "to-shoot5-29": "SHOOT5",
      "to-sweep-2-30": "SWEEP_2",
      "to-shoot5-31": "SHOOT5",
      "to-sweep-3-32": "SWEEP_3",
      "to-shoot5-33": "SHOOT5",
      "to-sweep-4-34": "SWEEP_4",
      "to-shoot5-35": "SHOOT5",
      "to-sweep-5-36": "SWEEP_5",
      "to-shoot5-37": "SHOOT5",
      "to-sweep-6-38": "SWEEP_6",
      "to-shoot5-39": "SHOOT5"
    },
    "startAt": "START",
    "cards": [
      {
        "id": "w-1",
        "kind": "firstOf",
        "label": "Fire the preloads (TIP 1)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 4000,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-2",
        "kind": "path",
        "lineId": "to-catch-1",
        "park": false
      },
      {
        "id": "w-3",
        "kind": "firstOf",
        "label": "TIP 1?",
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
        ]
      },
      {
        "id": "w-4",
        "kind": "firstOf",
        "label": "TIP 1: catch the spill",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 2600,
            "cards": []
          }
        ]
      },
      {
        "id": "w-9",
        "kind": "firstOf",
        "label": "Caught 4?",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": [],
            "label": "Yes"
          },
          {
            "afterMs": 400,
            "cards": [
              {
                "id": "p-5",
                "kind": "path",
                "lineId": "to-look-2",
                "park": false
              },
              {
                "id": "w-6",
                "kind": "firstOf",
                "label": "Pick up the rest (3)",
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
                ],
                "alongside": "CollectSeen"
              },
              {
                "id": "p-7",
                "kind": "path",
                "lineId": "to-catch-a-3",
                "park": false
              },
              {
                "id": "p-8",
                "kind": "path",
                "lineId": "to-catch-4",
                "park": false
              }
            ],
            "label": "No: look"
          }
        ]
      },
      {
        "id": "w-10",
        "kind": "firstOf",
        "label": "Stage the catch (3)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 1500,
            "cards": []
          }
        ],
        "alongside": "SetDown"
      },
      {
        "id": "p-11",
        "kind": "path",
        "lineId": "to-garden-in-5",
        "park": false
      },
      {
        "id": "a-12",
        "kind": "action",
        "name": "IntakeOn"
      },
      {
        "id": "p-13",
        "kind": "path",
        "lineId": "to-garden-6",
        "park": false
      },
      {
        "id": "w-14",
        "kind": "firstOf",
        "label": "The GARDEN",
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
        "id": "p-15",
        "kind": "path",
        "lineId": "to-catch-7",
        "park": false
      },
      {
        "id": "w-16",
        "kind": "firstOf",
        "label": "Our CELL up (3)",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 14000,
            "cards": []
          }
        ]
      },
      {
        "id": "w-17",
        "kind": "firstOf",
        "label": "Fire what we carry (TIP 3)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 600,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "a-18",
        "kind": "action",
        "name": "IntakeOn"
      },
      {
        "id": "p-19",
        "kind": "path",
        "lineId": "to-onto-8",
        "park": false
      },
      {
        "id": "w-20",
        "kind": "firstOf",
        "label": "Onto the row (TIP 3)",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 500,
            "cards": []
          }
        ]
      },
      {
        "id": "p-21",
        "kind": "path",
        "lineId": "to-collect-9",
        "park": false
      },
      {
        "id": "w-22",
        "kind": "firstOf",
        "label": "Pick up the row (TIP 3)",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 700,
            "cards": []
          }
        ]
      },
      {
        "id": "w-23",
        "kind": "firstOf",
        "label": "Fire the row (TIP 3)",
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
        "id": "p-24",
        "kind": "path",
        "lineId": "to-catch-10",
        "park": false
      },
      {
        "id": "w-53",
        "kind": "firstOf",
        "label": "Tipped? (3)",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": [],
            "label": "Yes"
          },
          {
            "afterMs": 800,
            "cards": [
              {
                "id": "w-50",
                "kind": "firstOf",
                "label": "Pick up what we see (3)",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2500,
                    "cards": []
                  }
                ],
                "alongside": "CollectSeen"
              },
              {
                "id": "w-51",
                "kind": "firstOf",
                "label": "Fire what we found (TIP 3)",
                "rows": [
                  {
                    "when": [
                      "Tip"
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
                "id": "w-52",
                "kind": "firstOf",
                "label": "Tipped now? (3)",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": [],
                    "label": "Yes"
                  },
                  {
                    "afterMs": 800,
                    "cards": [
                      {
                        "id": "p-25",
                        "kind": "path",
                        "lineId": "to-sweep-0-11",
                        "park": false
                      },
                      {
                        "id": "p-26",
                        "kind": "path",
                        "lineId": "to-sweep-1-12",
                        "park": false
                      },
                      {
                        "id": "w-49",
                        "kind": "firstOf",
                        "label": "Sweep for more (3) (1)",
                        "rows": [
                          {
                            "when": [
                              "IntakeFull"
                            ],
                            "cards": [
                              {
                                "id": "p-27",
                                "kind": "path",
                                "lineId": "to-catch-13",
                                "park": false
                              },
                              {
                                "id": "w-28",
                                "kind": "firstOf",
                                "label": "Fire again (TIP 3)",
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
                              }
                            ],
                            "label": "Full"
                          },
                          {
                            "afterMs": 350,
                            "cards": [
                              {
                                "id": "p-29",
                                "kind": "path",
                                "lineId": "to-sweep-2-14",
                                "park": false
                              },
                              {
                                "id": "w-48",
                                "kind": "firstOf",
                                "label": "Sweep for more (3) (2)",
                                "rows": [
                                  {
                                    "when": [
                                      "IntakeFull"
                                    ],
                                    "cards": [
                                      {
                                        "id": "p-30",
                                        "kind": "path",
                                        "lineId": "to-catch-15",
                                        "park": false
                                      },
                                      {
                                        "id": "w-31",
                                        "kind": "firstOf",
                                        "label": "Fire again (TIP 3)",
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
                                      }
                                    ],
                                    "label": "Full"
                                  },
                                  {
                                    "afterMs": 350,
                                    "cards": [
                                      {
                                        "id": "p-32",
                                        "kind": "path",
                                        "lineId": "to-sweep-3-16",
                                        "park": false
                                      },
                                      {
                                        "id": "w-47",
                                        "kind": "firstOf",
                                        "label": "Sweep for more (3) (3)",
                                        "rows": [
                                          {
                                            "when": [
                                              "IntakeFull"
                                            ],
                                            "cards": [
                                              {
                                                "id": "p-33",
                                                "kind": "path",
                                                "lineId": "to-catch-17",
                                                "park": false
                                              },
                                              {
                                                "id": "w-34",
                                                "kind": "firstOf",
                                                "label": "Fire again (TIP 3)",
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
                                              }
                                            ],
                                            "label": "Full"
                                          },
                                          {
                                            "afterMs": 350,
                                            "cards": [
                                              {
                                                "id": "p-35",
                                                "kind": "path",
                                                "lineId": "to-sweep-4-18",
                                                "park": false
                                              },
                                              {
                                                "id": "w-46",
                                                "kind": "firstOf",
                                                "label": "Sweep for more (3) (4)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "IntakeFull"
                                                    ],
                                                    "cards": [
                                                      {
                                                        "id": "p-36",
                                                        "kind": "path",
                                                        "lineId": "to-catch-19",
                                                        "park": false
                                                      },
                                                      {
                                                        "id": "w-37",
                                                        "kind": "firstOf",
                                                        "label": "Fire again (TIP 3)",
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
                                                      }
                                                    ],
                                                    "label": "Full"
                                                  },
                                                  {
                                                    "afterMs": 350,
                                                    "cards": [
                                                      {
                                                        "id": "p-38",
                                                        "kind": "path",
                                                        "lineId": "to-sweep-5-20",
                                                        "park": false
                                                      },
                                                      {
                                                        "id": "w-45",
                                                        "kind": "firstOf",
                                                        "label": "Sweep for more (3) (5)",
                                                        "rows": [
                                                          {
                                                            "when": [
                                                              "IntakeFull"
                                                            ],
                                                            "cards": [
                                                              {
                                                                "id": "p-39",
                                                                "kind": "path",
                                                                "lineId": "to-catch-21",
                                                                "park": false
                                                              },
                                                              {
                                                                "id": "w-40",
                                                                "kind": "firstOf",
                                                                "label": "Fire again (TIP 3)",
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
                                                              }
                                                            ],
                                                            "label": "Full"
                                                          },
                                                          {
                                                            "afterMs": 350,
                                                            "cards": [
                                                              {
                                                                "id": "p-41",
                                                                "kind": "path",
                                                                "lineId": "to-sweep-6-22",
                                                                "park": false
                                                              },
                                                              {
                                                                "id": "w-42",
                                                                "kind": "firstOf",
                                                                "label": "Sweep for more (3) (6)",
                                                                "rows": [
                                                                  {
                                                                    "when": [
                                                                      "IntakeFull"
                                                                    ],
                                                                    "cards": []
                                                                  },
                                                                  {
                                                                    "afterMs": 500,
                                                                    "cards": []
                                                                  }
                                                                ]
                                                              },
                                                              {
                                                                "id": "p-43",
                                                                "kind": "path",
                                                                "lineId": "to-catch-23",
                                                                "park": false
                                                              },
                                                              {
                                                                "id": "w-44",
                                                                "kind": "firstOf",
                                                                "label": "Fire again (TIP 3)",
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
                                                              }
                                                            ],
                                                            "label": "Not yet"
                                                          }
                                                        ]
                                                      }
                                                    ],
                                                    "label": "Not yet"
                                                  }
                                                ]
                                              }
                                            ],
                                            "label": "Not yet"
                                          }
                                        ]
                                      }
                                    ],
                                    "label": "Not yet"
                                  }
                                ]
                              }
                            ],
                            "label": "Not yet"
                          }
                        ]
                      }
                    ],
                    "label": "No: the wall"
                  }
                ]
              }
            ],
            "label": "No: look"
          }
        ]
      },
      {
        "id": "w-54",
        "kind": "firstOf",
        "label": "TIP 3: catch the spill",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 2500,
            "cards": []
          }
        ]
      },
      {
        "id": "p-55",
        "kind": "path",
        "lineId": "to-wall-stage-24",
        "park": false
      },
      {
        "id": "w-56",
        "kind": "firstOf",
        "label": "Stage the catch (5)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 1500,
            "cards": []
          }
        ],
        "alongside": "SetDown"
      },
      {
        "id": "p-57",
        "kind": "path",
        "lineId": "to-look5-25",
        "park": false
      },
      {
        "id": "a-58",
        "kind": "action",
        "name": "IntakeOn"
      },
      {
        "id": "w-59",
        "kind": "firstOf",
        "label": "Pick up the leftovers (5)",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 3500,
            "cards": []
          }
        ],
        "alongside": "CollectSeen"
      },
      {
        "id": "p-60",
        "kind": "path",
        "lineId": "to-hold5-26",
        "park": false
      },
      {
        "id": "w-61",
        "kind": "firstOf",
        "label": "Our CELL up (5)",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 14000,
            "cards": []
          }
        ]
      },
      {
        "id": "w-62",
        "kind": "firstOf",
        "label": "Fire what we carry (TIP 5)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 600,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-63",
        "kind": "path",
        "lineId": "to-sweep-0-27",
        "park": false
      },
      {
        "id": "p-64",
        "kind": "path",
        "lineId": "to-sweep-1-28",
        "park": false
      },
      {
        "id": "w-123",
        "kind": "firstOf",
        "label": "Sweep the wall (5) (1)",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": [
              {
                "id": "p-65",
                "kind": "path",
                "lineId": "to-shoot5-29",
                "park": false
              },
              {
                "id": "w-66",
                "kind": "firstOf",
                "label": "Fire again (TIP 5)",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 1500,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              },
              {
                "id": "w-69",
                "kind": "firstOf",
                "label": "Tipped? (5)",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": [],
                    "label": "Yes"
                  },
                  {
                    "afterMs": 50,
                    "cards": [
                      {
                        "id": "w-67",
                        "kind": "firstOf",
                        "label": "Pick up more (5.1)",
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
                        ],
                        "alongside": "CollectSeen"
                      },
                      {
                        "id": "w-68",
                        "kind": "firstOf",
                        "label": "Fire once more (5.1)",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 1200,
                            "cards": []
                          }
                        ],
                        "alongside": "LaunchAll"
                      }
                    ],
                    "label": "No: more"
                  }
                ]
              },
              {
                "id": "w-72",
                "kind": "firstOf",
                "label": "Tipped? (5)",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": [],
                    "label": "Yes"
                  },
                  {
                    "afterMs": 50,
                    "cards": [
                      {
                        "id": "w-70",
                        "kind": "firstOf",
                        "label": "Pick up more (5.2)",
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
                        ],
                        "alongside": "CollectSeen"
                      },
                      {
                        "id": "w-71",
                        "kind": "firstOf",
                        "label": "Fire once more (5.2)",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 1200,
                            "cards": []
                          }
                        ],
                        "alongside": "LaunchAll"
                      }
                    ],
                    "label": "No: more"
                  }
                ]
              }
            ],
            "label": "Full"
          },
          {
            "afterMs": 350,
            "cards": [
              {
                "id": "p-73",
                "kind": "path",
                "lineId": "to-sweep-2-30",
                "park": false
              },
              {
                "id": "w-122",
                "kind": "firstOf",
                "label": "Sweep the wall (5) (2)",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": [
                      {
                        "id": "p-74",
                        "kind": "path",
                        "lineId": "to-shoot5-31",
                        "park": false
                      },
                      {
                        "id": "w-75",
                        "kind": "firstOf",
                        "label": "Fire again (TIP 5)",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": []
                          },
                          {
                            "afterMs": 1500,
                            "cards": []
                          }
                        ],
                        "alongside": "LaunchAll"
                      },
                      {
                        "id": "w-78",
                        "kind": "firstOf",
                        "label": "Tipped? (5)",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": [],
                            "label": "Yes"
                          },
                          {
                            "afterMs": 50,
                            "cards": [
                              {
                                "id": "w-76",
                                "kind": "firstOf",
                                "label": "Pick up more (5.1)",
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
                                ],
                                "alongside": "CollectSeen"
                              },
                              {
                                "id": "w-77",
                                "kind": "firstOf",
                                "label": "Fire once more (5.1)",
                                "rows": [
                                  {
                                    "when": [
                                      "LeftCellUp"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 1200,
                                    "cards": []
                                  }
                                ],
                                "alongside": "LaunchAll"
                              }
                            ],
                            "label": "No: more"
                          }
                        ]
                      },
                      {
                        "id": "w-81",
                        "kind": "firstOf",
                        "label": "Tipped? (5)",
                        "rows": [
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": [],
                            "label": "Yes"
                          },
                          {
                            "afterMs": 50,
                            "cards": [
                              {
                                "id": "w-79",
                                "kind": "firstOf",
                                "label": "Pick up more (5.2)",
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
                                ],
                                "alongside": "CollectSeen"
                              },
                              {
                                "id": "w-80",
                                "kind": "firstOf",
                                "label": "Fire once more (5.2)",
                                "rows": [
                                  {
                                    "when": [
                                      "LeftCellUp"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 1200,
                                    "cards": []
                                  }
                                ],
                                "alongside": "LaunchAll"
                              }
                            ],
                            "label": "No: more"
                          }
                        ]
                      }
                    ],
                    "label": "Full"
                  },
                  {
                    "afterMs": 350,
                    "cards": [
                      {
                        "id": "p-82",
                        "kind": "path",
                        "lineId": "to-sweep-3-32",
                        "park": false
                      },
                      {
                        "id": "w-121",
                        "kind": "firstOf",
                        "label": "Sweep the wall (5) (3)",
                        "rows": [
                          {
                            "when": [
                              "IntakeFull"
                            ],
                            "cards": [
                              {
                                "id": "p-83",
                                "kind": "path",
                                "lineId": "to-shoot5-33",
                                "park": false
                              },
                              {
                                "id": "w-84",
                                "kind": "firstOf",
                                "label": "Fire again (TIP 5)",
                                "rows": [
                                  {
                                    "when": [
                                      "LeftCellUp"
                                    ],
                                    "cards": []
                                  },
                                  {
                                    "afterMs": 1500,
                                    "cards": []
                                  }
                                ],
                                "alongside": "LaunchAll"
                              },
                              {
                                "id": "w-87",
                                "kind": "firstOf",
                                "label": "Tipped? (5)",
                                "rows": [
                                  {
                                    "when": [
                                      "LeftCellUp"
                                    ],
                                    "cards": [],
                                    "label": "Yes"
                                  },
                                  {
                                    "afterMs": 50,
                                    "cards": [
                                      {
                                        "id": "w-85",
                                        "kind": "firstOf",
                                        "label": "Pick up more (5.1)",
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
                                        ],
                                        "alongside": "CollectSeen"
                                      },
                                      {
                                        "id": "w-86",
                                        "kind": "firstOf",
                                        "label": "Fire once more (5.1)",
                                        "rows": [
                                          {
                                            "when": [
                                              "LeftCellUp"
                                            ],
                                            "cards": []
                                          },
                                          {
                                            "afterMs": 1200,
                                            "cards": []
                                          }
                                        ],
                                        "alongside": "LaunchAll"
                                      }
                                    ],
                                    "label": "No: more"
                                  }
                                ]
                              },
                              {
                                "id": "w-90",
                                "kind": "firstOf",
                                "label": "Tipped? (5)",
                                "rows": [
                                  {
                                    "when": [
                                      "LeftCellUp"
                                    ],
                                    "cards": [],
                                    "label": "Yes"
                                  },
                                  {
                                    "afterMs": 50,
                                    "cards": [
                                      {
                                        "id": "w-88",
                                        "kind": "firstOf",
                                        "label": "Pick up more (5.2)",
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
                                        ],
                                        "alongside": "CollectSeen"
                                      },
                                      {
                                        "id": "w-89",
                                        "kind": "firstOf",
                                        "label": "Fire once more (5.2)",
                                        "rows": [
                                          {
                                            "when": [
                                              "LeftCellUp"
                                            ],
                                            "cards": []
                                          },
                                          {
                                            "afterMs": 1200,
                                            "cards": []
                                          }
                                        ],
                                        "alongside": "LaunchAll"
                                      }
                                    ],
                                    "label": "No: more"
                                  }
                                ]
                              }
                            ],
                            "label": "Full"
                          },
                          {
                            "afterMs": 350,
                            "cards": [
                              {
                                "id": "p-91",
                                "kind": "path",
                                "lineId": "to-sweep-4-34",
                                "park": false
                              },
                              {
                                "id": "w-120",
                                "kind": "firstOf",
                                "label": "Sweep the wall (5) (4)",
                                "rows": [
                                  {
                                    "when": [
                                      "IntakeFull"
                                    ],
                                    "cards": [
                                      {
                                        "id": "p-92",
                                        "kind": "path",
                                        "lineId": "to-shoot5-35",
                                        "park": false
                                      },
                                      {
                                        "id": "w-93",
                                        "kind": "firstOf",
                                        "label": "Fire again (TIP 5)",
                                        "rows": [
                                          {
                                            "when": [
                                              "LeftCellUp"
                                            ],
                                            "cards": []
                                          },
                                          {
                                            "afterMs": 1500,
                                            "cards": []
                                          }
                                        ],
                                        "alongside": "LaunchAll"
                                      },
                                      {
                                        "id": "w-96",
                                        "kind": "firstOf",
                                        "label": "Tipped? (5)",
                                        "rows": [
                                          {
                                            "when": [
                                              "LeftCellUp"
                                            ],
                                            "cards": [],
                                            "label": "Yes"
                                          },
                                          {
                                            "afterMs": 50,
                                            "cards": [
                                              {
                                                "id": "w-94",
                                                "kind": "firstOf",
                                                "label": "Pick up more (5.1)",
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
                                                ],
                                                "alongside": "CollectSeen"
                                              },
                                              {
                                                "id": "w-95",
                                                "kind": "firstOf",
                                                "label": "Fire once more (5.1)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": []
                                                  },
                                                  {
                                                    "afterMs": 1200,
                                                    "cards": []
                                                  }
                                                ],
                                                "alongside": "LaunchAll"
                                              }
                                            ],
                                            "label": "No: more"
                                          }
                                        ]
                                      },
                                      {
                                        "id": "w-99",
                                        "kind": "firstOf",
                                        "label": "Tipped? (5)",
                                        "rows": [
                                          {
                                            "when": [
                                              "LeftCellUp"
                                            ],
                                            "cards": [],
                                            "label": "Yes"
                                          },
                                          {
                                            "afterMs": 50,
                                            "cards": [
                                              {
                                                "id": "w-97",
                                                "kind": "firstOf",
                                                "label": "Pick up more (5.2)",
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
                                                ],
                                                "alongside": "CollectSeen"
                                              },
                                              {
                                                "id": "w-98",
                                                "kind": "firstOf",
                                                "label": "Fire once more (5.2)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": []
                                                  },
                                                  {
                                                    "afterMs": 1200,
                                                    "cards": []
                                                  }
                                                ],
                                                "alongside": "LaunchAll"
                                              }
                                            ],
                                            "label": "No: more"
                                          }
                                        ]
                                      }
                                    ],
                                    "label": "Full"
                                  },
                                  {
                                    "afterMs": 350,
                                    "cards": [
                                      {
                                        "id": "p-100",
                                        "kind": "path",
                                        "lineId": "to-sweep-5-36",
                                        "park": false
                                      },
                                      {
                                        "id": "w-119",
                                        "kind": "firstOf",
                                        "label": "Sweep the wall (5) (5)",
                                        "rows": [
                                          {
                                            "when": [
                                              "IntakeFull"
                                            ],
                                            "cards": [
                                              {
                                                "id": "p-101",
                                                "kind": "path",
                                                "lineId": "to-shoot5-37",
                                                "park": false
                                              },
                                              {
                                                "id": "w-102",
                                                "kind": "firstOf",
                                                "label": "Fire again (TIP 5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": []
                                                  },
                                                  {
                                                    "afterMs": 1500,
                                                    "cards": []
                                                  }
                                                ],
                                                "alongside": "LaunchAll"
                                              },
                                              {
                                                "id": "w-105",
                                                "kind": "firstOf",
                                                "label": "Tipped? (5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": [],
                                                    "label": "Yes"
                                                  },
                                                  {
                                                    "afterMs": 50,
                                                    "cards": [
                                                      {
                                                        "id": "w-103",
                                                        "kind": "firstOf",
                                                        "label": "Pick up more (5.1)",
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
                                                        ],
                                                        "alongside": "CollectSeen"
                                                      },
                                                      {
                                                        "id": "w-104",
                                                        "kind": "firstOf",
                                                        "label": "Fire once more (5.1)",
                                                        "rows": [
                                                          {
                                                            "when": [
                                                              "LeftCellUp"
                                                            ],
                                                            "cards": []
                                                          },
                                                          {
                                                            "afterMs": 1200,
                                                            "cards": []
                                                          }
                                                        ],
                                                        "alongside": "LaunchAll"
                                                      }
                                                    ],
                                                    "label": "No: more"
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "w-108",
                                                "kind": "firstOf",
                                                "label": "Tipped? (5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": [],
                                                    "label": "Yes"
                                                  },
                                                  {
                                                    "afterMs": 50,
                                                    "cards": [
                                                      {
                                                        "id": "w-106",
                                                        "kind": "firstOf",
                                                        "label": "Pick up more (5.2)",
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
                                                        ],
                                                        "alongside": "CollectSeen"
                                                      },
                                                      {
                                                        "id": "w-107",
                                                        "kind": "firstOf",
                                                        "label": "Fire once more (5.2)",
                                                        "rows": [
                                                          {
                                                            "when": [
                                                              "LeftCellUp"
                                                            ],
                                                            "cards": []
                                                          },
                                                          {
                                                            "afterMs": 1200,
                                                            "cards": []
                                                          }
                                                        ],
                                                        "alongside": "LaunchAll"
                                                      }
                                                    ],
                                                    "label": "No: more"
                                                  }
                                                ]
                                              }
                                            ],
                                            "label": "Full"
                                          },
                                          {
                                            "afterMs": 350,
                                            "cards": [
                                              {
                                                "id": "p-109",
                                                "kind": "path",
                                                "lineId": "to-sweep-6-38",
                                                "park": false
                                              },
                                              {
                                                "id": "w-110",
                                                "kind": "firstOf",
                                                "label": "Sweep the wall (5) (6)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "IntakeFull"
                                                    ],
                                                    "cards": []
                                                  },
                                                  {
                                                    "afterMs": 500,
                                                    "cards": []
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "p-111",
                                                "kind": "path",
                                                "lineId": "to-shoot5-39",
                                                "park": false
                                              },
                                              {
                                                "id": "w-112",
                                                "kind": "firstOf",
                                                "label": "Fire again (TIP 5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": []
                                                  },
                                                  {
                                                    "afterMs": 1500,
                                                    "cards": []
                                                  }
                                                ],
                                                "alongside": "LaunchAll"
                                              },
                                              {
                                                "id": "w-115",
                                                "kind": "firstOf",
                                                "label": "Tipped? (5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": [],
                                                    "label": "Yes"
                                                  },
                                                  {
                                                    "afterMs": 50,
                                                    "cards": [
                                                      {
                                                        "id": "w-113",
                                                        "kind": "firstOf",
                                                        "label": "Pick up more (5.1)",
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
                                                        ],
                                                        "alongside": "CollectSeen"
                                                      },
                                                      {
                                                        "id": "w-114",
                                                        "kind": "firstOf",
                                                        "label": "Fire once more (5.1)",
                                                        "rows": [
                                                          {
                                                            "when": [
                                                              "LeftCellUp"
                                                            ],
                                                            "cards": []
                                                          },
                                                          {
                                                            "afterMs": 1200,
                                                            "cards": []
                                                          }
                                                        ],
                                                        "alongside": "LaunchAll"
                                                      }
                                                    ],
                                                    "label": "No: more"
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "w-118",
                                                "kind": "firstOf",
                                                "label": "Tipped? (5)",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": [],
                                                    "label": "Yes"
                                                  },
                                                  {
                                                    "afterMs": 50,
                                                    "cards": [
                                                      {
                                                        "id": "w-116",
                                                        "kind": "firstOf",
                                                        "label": "Pick up more (5.2)",
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
                                                        ],
                                                        "alongside": "CollectSeen"
                                                      },
                                                      {
                                                        "id": "w-117",
                                                        "kind": "firstOf",
                                                        "label": "Fire once more (5.2)",
                                                        "rows": [
                                                          {
                                                            "when": [
                                                              "LeftCellUp"
                                                            ],
                                                            "cards": []
                                                          },
                                                          {
                                                            "afterMs": 1200,
                                                            "cards": []
                                                          }
                                                        ],
                                                        "alongside": "LaunchAll"
                                                      }
                                                    ],
                                                    "label": "No: more"
                                                  }
                                                ]
                                              }
                                            ],
                                            "label": "Not yet"
                                          }
                                        ]
                                      }
                                    ],
                                    "label": "Not yet"
                                  }
                                ]
                              }
                            ],
                            "label": "Not yet"
                          }
                        ]
                      }
                    ],
                    "label": "Not yet"
                  }
                ]
              }
            ],
            "label": "Not yet"
          }
        ]
      }
    ]
  },
  "version": "1.5.0"
}