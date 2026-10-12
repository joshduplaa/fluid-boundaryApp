function [equation, leastSquareError, conditionA, conditionATA] = higherOrder(A, b)
    
    %Augment A for cubic polynomial, adding columns for x^2 and x^3
    A = [ones(size(A, 1), 1), A, A.^2, A.^3];  % Add a column of ones, A, A^2, and A^3
    
    %finding x using normal equations
    x = ((A'*A)^(-1)) * (A' * b);
    
    %disp("The coefficients of the cubic regression are:");
    %disp(x);
    
    %printing out y = ax^3 + bx^2 + cx + d 
    a = x(4);
    b_coefficient = x(3);
    c = x(2);
    d = x(1);
    
    equation = sprintf("y = %.4fx^3 + %.4fx^2 + %.4fx + %.4f\n", a, b_coefficient, c, d);
    %fprintf("The least square cubic approximation is: y = %fx^3 + %fx^2 + %fx + %f\n", a, b_coefficient, c, d);
    
    %find least square error
    %I need to find b(hat). so b(hat) = A*x
    %the residuals are z = b - b(hat), difference between actual y value andpredicted y value
    % z is a list of residuals essentially
    error = 0;
    bHat = A*x;
    z = b - bHat;
    
    %the error is the sum of the squared residuals, sum(residuals^2)
    for i = 1:length(z)
        error = error + (z(i)^2);
    end
    leastSquareError = error;
    
    
    %evaluating stability with the condition number
    conditionA = cond(A);
    conditionATA = cond(A'*A);
    %fprintf("the condition of A is %f and the condition of ATA is %f", conditionA, conditionATA);
end