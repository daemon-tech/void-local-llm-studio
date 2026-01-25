// calculator.js

function evaluate(expression) {
  const tokens = expression.split(/\s+/);
  const stack = [];

  for (const token of tokens) {
    if (!isNaN(token)) {
      stack.push(parseFloat(token));
    } else {
      const b = stack.pop();
      const a = stack.pop();
      switch (token) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (b === 0) throw new Error('Division by zero');
          stack.push(a / b);
          break;
        default:
          throw new Error(`Unknown operator: ${token}`);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid expression');
  }

  return stack.pop();
}

module.exports = { evaluate };
