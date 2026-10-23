# Third-party material

## OpenCV LBP frontal face cascade
`src/core/faceCascade.ts` is generated (scripts/gen-face-cascade.py) from `lbpcascade_frontalface_opencv.xml`, a trained data file from the OpenCV project (https://github.com/opencv/opencv/tree/master/data/lbpcascades), as redistributed with scikit-image's sample data.

OpenCV is distributed under the 3-clause BSD licence (Apache 2.0 from OpenCV 4.5 on). The BSD terms: redistribution and use in source and binary forms, with or without modification, are permitted provided that the copyright notice, this list of conditions and the following disclaimer are retained in source and reproduced in documentation for binaries; neither the names of the copyright holders nor contributors may be used to endorse products without permission. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.

Copyright (C) 2000-2008, Intel Corporation; (C) 2008-2015 Willow Garage, Itseez and the OpenCV contributors. The app's About screen should credit "Face detection data © OpenCV contributors (BSD licence)" before store release (see R3).

## Fonts used for lettering templates
Lettering template outlines (scripts/templategen/ornament.py) are derived from Lora, Young Serif, Gloock and Poppins (SIL Open Font License 1.1) and TeX Gyre Chorus (GUST Font License). Only letter shapes are used; the fonts themselves are not bundled.
