%Joshua Duplaa
%Final Assignment Part 1
%Least squares using Normal Equations Method
%matrix with x points in first column and y points in second column

filename = 'marker.xlsx'; 
data = readtable(filename);
display(data)

cells = unique(data.elem);

%display(cells)

%creating columns, empty lists for the columns 
line = [];
parabola = [];
higher = [];
rot_parabola = [];

line_Error = [];
parabola_Error = [];
higher_Error = [];
rot_parabola_Error = [];


for i = 1:length(cells)
    fprintf("processing cell %d", cells(i))
    cellRows = data(data.elem==cells(i), :);
    A = table2array(cellRows(:,1)); %xColumn
    b = table2array(cellRows(:,2)); %YColumn

    display(A);
    display(b);

    %linear approximation
    [equation_Lin, leastSquareError_Lin, conditionA_Lin, conditionATA_Lin] = linearApprox(A, b);
    
    %second order approximation
    [equation_Sec, leastSquareError_Sec, conditionA_Sec, conditionATA_Sec] = secondOrder(A, b);
    
    %Higher order approximation (cubic)
    [equation_High, leastSquareError_High, conditionA_High, conditionATA_High] = higherOrder(A, b);
    
    %using a rotated parabola x = ay2 + by + c, essentially just second order but flipped parameters x y
    [equation_Rot, leastSquareError_Rot, conditionA_Rot, conditionATA_Rot] = rotatedParabola(b, A);
    
    %Adding to approximation equation table
    line = [line; equation_Lin];
    parabola = [parabola; equation_Sec];
    higher = [higher; equation_High];
    rot_parabola = [rot_parabola; equation_Rot];

    %adding to approximation error table
    line_Error = [line_Error; leastSquareError_Lin];
    parabola_Error = [parabola_Error; leastSquareError_Sec];
    higher_Error = [higher_Error; leastSquareError_High];
    rot_parabola_Error = [rot_parabola_Error; leastSquareError_Rot];

end

%approximation equation table
equationTable = table(cells, line, parabola, higher, rot_parabola);
display(equationTable);
%approximation error table
errorTable = table(cells, line_Error, parabola_Error, higher_Error, rot_parabola_Error);
display(errorTable)
%writing the tables to a csv file for better viewing.
writetable(equationTable,'equation_table.csv');
writetable(errorTable,'error_table.csv');
