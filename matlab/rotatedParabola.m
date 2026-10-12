%Basically the second order script with switched parameters when calling.
%I also changed the print statement. This is essentially just switching parameters.
%b is brought in as A and A is brought in as b.


function [equation, leastSquareError, conditionA, conditionATA] = rotatedParabola(A, b)
    
    %augment matrix A for second-order polynomial
    A = [ones(size(A, 1), 1), A, A.^2];  %add a column of ones, A, and A^2
    
    %find x using normal equations
    x = ((A'*A)^(-1))*(A'*b);
    
    %disp("The coefficients of the second-order regression are:");
    %disp(x);
    
    % Print out the y = ax^2 + bx + c with coefficients a, b, and c
    % ACTUALLY, since this is rotated it's x = ay^2 + by + c
    a = x(3);
    b_coefficient = x(2);
    c = x(1);
    
    equation = sprintf("x = %.4fy^2 + %.4fy + %.4f\n", a, b_coefficient, c);
    %fprintf("The least square rotated parabola line approximation is : x = %fy^2 + %fy + %f\n", a, b_coefficient, c);

    
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