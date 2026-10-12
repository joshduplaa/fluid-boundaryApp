function [equation, leastSquareError, conditionA, conditionATA] = linearApprox(A, b)
    
    %linear line least square apporximation
    %add a column of 1s to augment matrix A
    A = [ones(size(A, 1), 1), A];  %insert a column of ones as the first column
    
    %find x using normal equations
    
    x = ((A'*A)^(-1))*(A'*b);
    
    %disp("The coefficients of the linear regression are:");
    %disp(x);
    
    %print out the y = mx + q with coefficienct m and q
    
    m = x(2);
    q = x(1);
    
    equation = sprintf("y = %.4fx + %.4f", m, q);
    %fprintf("The least square linear line approximation is : y = %fx + %f", m, q)
    
    
    
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
    
    %The condition of ATA is much higher the condition of A. So the Normal method for least squares approximation is unstable.
end