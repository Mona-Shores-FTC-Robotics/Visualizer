{
  "version": "2.0.0",
  "timestamp": "2026-11-28T05:14:20.000Z",
  "startPoint": {
    "x": 55.6,
    "y": 7.7,
    "locked": false,
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "line-r-solo-to-right-auto-hive",
      "color": "#76b7b2",
      "name": "to RIGHT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 96.1
      }
    },
    {
      "kind": "atomic",
      "id": "line-mwz1k4kk-1hgwv3",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 15.247235273970453,
          "y": 41.5582083271939
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 96.1,
        "endDeg": 270
      },
      "color": "#59a14f",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "name": "RIGHT_AUTO_HIVE park"
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 96.10000000000002
      }
    },
    {
      "id": "line-mw0be8id-zhk73u",
      "color": "#59a14f",
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
        "startDeg": 96.1,
        "endDeg": 180
      }
    },
    {
      "id": "line-mw0cnl7i-qkksz9",
      "color": "#f28e2b",
      "name": "WALL_FLOWER_STAGING park",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 18,
          "y": 62
        },
        {
          "x": 14.5,
          "y": 74
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 180,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.4,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 180,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.4,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-2",
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
        "degrees": 179.99999999999997
      }
    },
    {
      "id": "line-mw2z05td-jkwfz4",
      "color": "#b07aa1",
      "name": "BACKWARD to LEFT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [
        {
          "x": 29.298561851629266,
          "y": 127.30521572102954
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 180,
        "endDeg": 268.9,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.35,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 180,
                "endDeg": 268.9
              }
            },
            {
              "startProgress": 0.35,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 268.9
              }
            }
          ]
        }
      }
    },
    {
      "id": "line-mw2z05th-whpzzi",
      "color": "#edc948",
      "name": "LEFT_AUTO_HIVE park",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 32,
          "y": 121
        },
        {
          "x": 33,
          "y": 104
        },
        {
          "x": 33,
          "y": 86
        },
        {
          "x": 33,
          "y": 76
        },
        {
          "x": 33,
          "y": 72
        },
        {
          "x": 14.5,
          "y": 70
        },
        {
          "x": 14.5,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 273,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 273,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-3",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -91.10000000000002
      }
    },
    {
      "id": "line-mw2h249a-6eklj4",
      "color": "#59a14f",
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
        "startDeg": -91.89999999999998,
        "endDeg": 90
      }
    },
    {
      "id": "line-mw2h249i-g9eamy",
      "color": "#f28e2b",
      "name": "SCORING_FLOWER_STAGING park",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 38,
          "y": 121
        },
        {
          "x": 32.5,
          "y": 106
        },
        {
          "x": 32.5,
          "y": 86
        },
        {
          "x": 32.5,
          "y": 76
        },
        {
          "x": 32.5,
          "y": 72
        },
        {
          "x": 14.5,
          "y": 70
        },
        {
          "x": 14.5,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 90,
        "endDeg": -90,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 90,
                "endDeg": -90
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
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
        "degrees": -270
      }
    },
    {
      "id": "line-mw2z8m8r-d4cyle",
      "color": "#e15759",
      "name": "to R_NECTAR_TURN",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 58.5,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 203.7
      }
    },
    {
      "id": "line-mw2h249a-0a0w4q",
      "color": "#b07aa1",
      "name": "R_NECTAR_TURN to RIGHT_PARK_WALL",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 32,
          "y": 121
        },
        {
          "x": 33,
          "y": 104
        },
        {
          "x": 33,
          "y": 86
        },
        {
          "x": 33,
          "y": 76
        },
        {
          "x": 33,
          "y": 72
        },
        {
          "x": 14.5,
          "y": 70
        },
        {
          "x": 14.5,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 203.7,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 203.7,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-5",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 58.5,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 203.7
      }
    },
    {
      "id": "line-mwdn0a01-rsp3c",
      "color": "#b07aa1",
      "name": "R_NECTAR_TURN to RIGHT_PARK_WALL",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 32,
          "y": 121
        },
        {
          "x": 33,
          "y": 104
        },
        {
          "x": 33,
          "y": 86
        },
        {
          "x": 33,
          "y": 76
        },
        {
          "x": 33,
          "y": 72
        },
        {
          "x": 14.5,
          "y": 70
        },
        {
          "x": 14.5,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 203.7,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 203.7,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-6",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -91.10000000000002
      }
    },
    {
      "id": "line-mw2z1rrz-ltmk3y",
      "color": "#9c755f",
      "name": "to RIGHT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
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
          "x": 56,
          "y": 40
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 268.9,
        "endDeg": 96.1,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 268.9,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 270,
                "endDeg": 96.1
              }
            }
          ]
        }
      }
    },
    {
      "id": "line-mw2h249b-qfhry3",
      "color": "#4e79a7",
      "name": "to RIGHT_PARK_WALL",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 40
        },
        {
          "x": 16,
          "y": 62
        },
        {
          "x": 14,
          "y": 72
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 96.10000000000002,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 96.10000000000002,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-7",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 96.10000000000002
      }
    },
    {
      "id": "line-mwdn0a01-rspfb",
      "color": "#4e79a7",
      "name": "to RIGHT_PARK_WALL",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 92.5
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 40
        },
        {
          "x": 16,
          "y": 62
        },
        {
          "x": 14,
          "y": 72
        }
      ],
      "heading": {
        "type": "piecewise",
        "startDeg": 96.10000000000002,
        "endDeg": 270,
        "degrees": 0,
        "reverse": false,
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "startDeg": 96.10000000000002,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "constant",
              "reversed": false,
              "continueFromPrevious": false,
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    }
  ],
  "shapes": [
    {
      "id": "biobuzz-red-hive",
      "name": "Red HIVE",
      "vertices": [
        {
          "x": 46,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 91.4
        },
        {
          "x": 46,
          "y": 91.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-blue-hive",
      "name": "Blue HIVE",
      "vertices": [
        {
          "x": 96.5,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 50
        },
        {
          "x": 96.5,
          "y": 50
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-top",
      "name": "Scoring-Side FLOWER",
      "vertices": [
        {
          "x": 43.4,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 139.4
        },
        {
          "x": 46.75,
          "y": 137.7
        },
        {
          "x": 43.4,
          "y": 139.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-flower-right",
      "name": "Blue Alliance FLOWER",
      "vertices": [
        {
          "x": 141.5,
          "y": 98.1
        },
        {
          "x": 139.4,
          "y": 98.1
        },
        {
          "x": 137.7,
          "y": 94.75
        },
        {
          "x": 139.4,
          "y": 91.4
        },
        {
          "x": 141.5,
          "y": 91.4
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-bottom",
      "name": "Audience-Side FLOWER",
      "vertices": [
        {
          "x": 91.15,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 2.1
        },
        {
          "x": 94.5,
          "y": 3.8
        },
        {
          "x": 91.15,
          "y": 2.1
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-left",
      "name": "Red Alliance FLOWER",
      "vertices": [
        {
          "x": 0,
          "y": 50.35
        },
        {
          "x": 2.1,
          "y": 50.35
        },
        {
          "x": 3.8,
          "y": 47
        },
        {
          "x": 2.1,
          "y": 43.65
        },
        {
          "x": 0,
          "y": 43.65
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "line-r-solo-to-right-auto-hive"
    },
    {
      "kind": "path",
      "lineId": "line-mwz1k4kk-1hgwv3"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "line-mw0be8id-zhk73u"
    },
    {
      "kind": "path",
      "lineId": "line-mw0cnl7i-qkksz9"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "line-mw2z05td-jkwfz4"
    },
    {
      "kind": "path",
      "lineId": "line-mw2z05th-whpzzi"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249a-6eklj4"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249i-g9eamy"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "line-mw2z8m8r-d4cyle"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249a-0a0w4q"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "line-mwdn0a01-rsp3c"
    },
    {
      "kind": "path",
      "lineId": "link-6"
    },
    {
      "kind": "path",
      "lineId": "line-mw2z1rrz-ltmk3y"
    },
    {
      "kind": "path",
      "lineId": "line-mw2h249b-qfhry3"
    },
    {
      "kind": "path",
      "lineId": "link-7"
    },
    {
      "kind": "path",
      "lineId": "line-mwdn0a01-rspfb"
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
        "PickFlower",
        "GardenGather",
        "LaunchOne",
        "SpinUp",
        "LaunchAllAimed",
        "LaunchOneAimed",
        "CatchNectar",
        "CallNectar"
      ],
      "conditions": [
        "Empty",
        "IntakeFull",
        "LeftCellUp",
        "RightCellUp",
        "Tip",
        "CameraBlind",
        "CellUp",
        "Always",
        "NectarIn"
      ],
      "events": [
        "Tip"
      ],
      "typicalS": {
        "LaunchAll": 2.5,
        "PickFlower": 4,
        "GardenGather": 3,
        "LaunchOne": 0.5,
        "SpinUp": 0.1,
        "LaunchAllAimed": 2.5,
        "LaunchOneAimed": 1.2,
        "CatchNectar": 0.6,
        "CallNectar": 0.1
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
      "SCORING_FLOWER_STAGING": [
        47.2,
        119.3,
        90
      ],
      "RIGHT_PARK": [
        14.5,
        98.7,
        0
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "LEFT_AUTO_HIVE": [
        61.4,
        120.45,
        268.9
      ],
      "RIGHT_AUTO_HIVE": [
        59.2,
        20.9,
        96.1
      ],
      "RIGHT_PARK_WALL": [
        14.5,
        92.5,
        270
      ],
      "R_NECTAR_TURN": [
        58.5,
        120.45,
        203.7
      ]
    },
    "pathEnds": {
      "line-mw0be8id-zhk73u": "WALL_FLOWER_STAGING",
      "line-mw0cnl7i-qkksz9": "RIGHT_PARK_WALL",
      "line-mw2h249a-6eklj4": "SCORING_FLOWER_STAGING",
      "line-mw2h249a-0a0w4q": "RIGHT_PARK_WALL",
      "line-mw2h249b-qfhry3": "RIGHT_PARK_WALL",
      "line-mw2h249i-g9eamy": "RIGHT_PARK_WALL",
      "line-mw2z05td-jkwfz4": "LEFT_AUTO_HIVE",
      "line-mw2z05th-whpzzi": "RIGHT_PARK_WALL",
      "line-mw2z1rrz-ltmk3y": "RIGHT_AUTO_HIVE",
      "line-mw2z8m8r-d4cyle": "R_NECTAR_TURN",
      "line-mwdn0a01-rsp3c": "RIGHT_PARK_WALL",
      "line-mwdn0a01-rspfb": "RIGHT_PARK_WALL",
      "line-r-solo-to-right-auto-hive": "RIGHT_AUTO_HIVE",
      "line-mwz1k4kk-1hgwv3": "RIGHT_PARK_WALL"
    },
    "cards": [
      {
        "id": "c-mw0be8ic-8rwew",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "c-r-solo-to-right-auto-hive",
        "kind": "path",
        "lineId": "line-r-solo-to-right-auto-hive",
        "park": false
      },
      {
        "id": "c-mw0be8ic-jdurq",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "c-mw0be8id-e596r",
        "kind": "path",
        "lineId": "line-mw0be8id-zhk73u",
        "park": false
      },
      {
        "id": "c-mw0be8id-fud0d",
        "kind": "action",
        "name": "PickFlower",
        "timeoutS": 4.5
      },
      {
        "id": "c-mw2z05td-62dzu",
        "kind": "path",
        "lineId": "line-mw2z05td-jkwfz4",
        "park": false
      },
      {
        "id": "c-mw2h249a-c0rs6",
        "kind": "firstOf",
        "label": "Wait for TIP or CELL up",
        "rows": [
          {
            "when": [
              "CellUp"
            ],
            "cards": [
              {
                "id": "c-mw2h249a-0np9s",
                "kind": "action",
                "name": "LaunchAll"
              },
              {
                "id": "c-mw2h249a-bml5p",
                "kind": "path",
                "lineId": "line-mw2h249a-6eklj4",
                "park": false
              },
              {
                "id": "c-mw2h249a-p7er4",
                "kind": "action",
                "name": "PickFlower",
                "timeoutS": 4.5
              },
              {
                "id": "c-rsn-callnectar",
                "kind": "action",
                "name": "CallNectar"
              },
              {
                "id": "c-mw2z8m8r-obclc",
                "kind": "path",
                "lineId": "line-mw2z8m8r-d4cyle",
                "park": false
              },
              {
                "id": "c-mwdn0a01-rsv3c",
                "kind": "firstOf",
                "label": "LEFT CELL still up?",
                "rows": [
                  {
                    "when": [
                      "CellUp"
                    ],
                    "cards": [
                      {
                        "id": "c-mw2h249a-p5yh3",
                        "kind": "action",
                        "name": "LaunchAllAimed"
                      },
                      {
                        "id": "c-rsn-hold",
                        "kind": "firstOf",
                        "label": "Hold for the human player's NECTAR, intake on: until it is in, at most 1.5 s",
                        "alongside": "CatchNectar",
                        "rows": [
                          {
                            "afterMs": 1500,
                            "cards": []
                          },
                          {
                            "when": [
                              "NectarIn"
                            ],
                            "cards": [
                              {
                                "id": "c-rsn-check",
                                "kind": "firstOf",
                                "label": "LEFT still up? (fire the NECTAR at LEFT)",
                                "rows": [
                                  {
                                    "when": [
                                      "CellUp"
                                    ],
                                    "cards": [
                                      {
                                        "id": "c-rsn-launchoneaimed",
                                        "kind": "action",
                                        "name": "LaunchOneAimed"
                                      }
                                    ]
                                  },
                                  {
                                    "afterMs": 750,
                                    "cards": []
                                  }
                                ]
                              }
                            ]
                          }
                        ]
                      },
                      {
                        "id": "c-mw2h249a-nxkzp",
                        "kind": "path",
                        "lineId": "line-mw2h249a-0a0w4q",
                        "park": true
                      }
                    ]
                  },
                  {
                    "afterMs": 750,
                    "cards": [
                      {
                        "id": "c-mwdn0a01-rsp3c",
                        "kind": "path",
                        "lineId": "line-mwdn0a01-rsp3c",
                        "park": true
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "afterMs": 750,
            "cards": [
              {
                "id": "c-mw2z1rrz-w27kx",
                "kind": "path",
                "lineId": "line-mw2z1rrz-ltmk3y",
                "park": false
              },
              {
                "id": "c-mwdn0a01-rsfb1",
                "kind": "firstOf",
                "label": "RIGHT CELL still up?",
                "rows": [
                  {
                    "when": [
                      "CellUp"
                    ],
                    "cards": [
                      {
                        "id": "c-mw2h249b-xpbq7",
                        "kind": "action",
                        "name": "LaunchAll"
                      },
                      {
                        "id": "c-mw2h249b-tphk6",
                        "kind": "path",
                        "lineId": "line-mw2h249b-qfhry3",
                        "park": true
                      }
                    ]
                  },
                  {
                    "afterMs": 750,
                    "cards": [
                      {
                        "id": "c-mwdn0a01-rspfb",
                        "kind": "path",
                        "lineId": "line-mwdn0a01-rspfb",
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
    "startAt": "RIGHT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4",
      "link-5",
      "link-6",
      "link-7"
    ],
    "parkFrom": {
      "c-mw0be8id-e596r": "line-mw0cnl7i-qkksz9",
      "c-mw2h249a-bml5p": "line-mw2h249i-g9eamy",
      "c-mw2z05td-62dzu": "line-mw2z05th-whpzzi",
      "c-r-solo-to-right-auto-hive": "line-mwz1k4kk-1hgwv3"
    },
    "teamSpots": [
      "GARDEN_STAGING",
      "LEFT_AUTO_HIVE",
      "RIGHT_AUTO_HIVE",
      "RIGHT_PARK",
      "RIGHT_START",
      "SCORING_FLOWER_STAGING",
      "WALL_FLOWER_STAGING"
    ],
    "exportName": "R-Solo"
  }
}