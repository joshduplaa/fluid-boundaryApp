%Joshua Duplaa
%Final Assignment Part 1
%Least squares using Normal Equations Method
%matrix with x points in first column and y points in second column

%X points
A = [0.121618
0.121146
0.125
0.124509
0.124021
0.123536
0.123053
0.122572
0.122094
];

%Y Points
b = [0.123018
0.125
0.109157
0.111135
0.113114
0.115094
0.117074
0.119055
0.121036
];

%linear approximation
[equation_Lin, leastSquareError_Lin, conditionA_Lin, conditionATA_Lin] = linearApprox(A, b);

%second order approximation
[equation_Sec, leastSquareError_Sec, conditionA_Sec, conditionATA_Sec] = secondOrder(A, b);

%Higher order approximation (cubic)
[equation_High, leastSquareError_High, conditionA_High, conditionATA_High] = higherOrder(A, b);

%using a rotated parabola x = ay2 + by + c, essentially just second order but flipped parameters x y
[equation_Rot, leastSquareError_Rot, conditionA_Rot, conditionATA_Rot] = rotatedParabola(b, A);

%table information from:
%https://www.mathworks.com/help/matlab/matlab_prog/create-a-table.html

%approximation equation table
line = [equation_Lin];
parabola = [equation_Sec];
higher = [equation_High];
rot_parabola = [equation_Rot];


approximationsTable = table(line, parabola, higher, rot_parabola);
display(approximationsTable);

%approximation error table
line_Error = [leastSquareError_Lin];
parabola_Error = [leastSquareError_Sec];
higher_Error = [leastSquareError_High];
rot_parabola_Error = [leastSquareError_Rot];

errorTable = table(line_Error, parabola_Error, higher_Error, rot_parabola_Error);
display(errorTable)