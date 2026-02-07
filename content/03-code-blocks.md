# Code Blocks and Syntax Highlighting

This document showcases code blocks with syntax highlighting for various programming languages.

## Inline Code

Use backticks for inline code: `const x = 42;` or `print("Hello")` or `SELECT * FROM users`.

You can also use inline code with special characters: `<div>`, `npm install`, `git commit -m "message"`.

---

## JavaScript / TypeScript

```javascript
// Function to calculate factorial
function factorial(n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// Arrow function with map
const numbers = [1, 2, 3, 4, 5];
const squared = numbers.map(n => n ** 2);

// Async/await example
async function fetchData(url) {
    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

console.log(squared); // [1, 4, 9, 16, 25]
```

```typescript
// TypeScript with types
interface User {
    id: number;
    name: string;
    email: string;
    isActive: boolean;
}

class UserManager {
    private users: User[] = [];

    addUser(user: User): void {
        this.users.push(user);
    }

    findUserById(id: number): User | undefined {
        return this.users.find(user => user.id === id);
    }

    getActiveUsers(): User[] {
        return this.users.filter(user => user.isActive);
    }
}

const manager = new UserManager();
```

---

## Python

```python
# Python class example
class Animal:
    def __init__(self, name, species):
        self.name = name
        self.species = species
    
    def make_sound(self):
        return f"{self.name} makes a sound"

class Dog(Animal):
    def __init__(self, name, breed):
        super().__init__(name, "Dog")
        self.breed = breed
    
    def make_sound(self):
        return f"{self.name} barks!"

# List comprehension
squares = [x**2 for x in range(10) if x % 2 == 0]

# Dictionary manipulation
user_data = {
    'name': 'John Doe',
    'age': 30,
    'email': 'john@example.com'
}

# Lambda functions
multiply = lambda x, y: x * y
result = multiply(5, 3)

print(f"Squares: {squares}")
print(f"Result: {result}")
```

---

## SQL

```sql
-- Complex SQL query with joins
SELECT 
    u.id,
    u.username,
    u.email,
    COUNT(o.id) as total_orders,
    SUM(o.amount) as total_spent,
    MAX(o.created_at) as last_order_date
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at >= '2024-01-01'
    AND u.is_active = true
GROUP BY u.id, u.username, u.email
HAVING COUNT(o.id) > 5
ORDER BY total_spent DESC
LIMIT 10;

-- Create table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert with conflict handling
INSERT INTO products (name, price, stock_quantity)
VALUES ('Widget', 29.99, 100)
ON CONFLICT (name) 
DO UPDATE SET 
    stock_quantity = products.stock_quantity + EXCLUDED.stock_quantity;
```

---

## HTML / CSS

```text
<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
  <strong>⚠️ Warning:</strong> This is a warning message with custom styling.
</div>
```

Would rendered as:

```html
<div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
  <strong>⚠️ Warning:</strong> This is a warning message with custom styling.
</div>
```

```css
/* Modern CSS with variables */
:root {
    --primary-color: #3498db;
    --secondary-color: #2ecc71;
    --text-color: #333;
    --bg-color: #f4f4f4;
    --spacing: 1rem;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: var(--text-color);
    background-color: var(--bg-color);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing);
}

/* Flexbox layout */
.flex-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing);
}

/* Grid layout */
.grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing);
}

/* Animations */
@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-in {
    animation: fadeIn 0.5s ease-in-out;
}
```

---

## JSON

```json
{
  "name": "mdnotes-viewer",
  "version": "1.0.0",
  "description": "A modern markdown viewer with live editing",
  "author": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "dependencies": {
    "react": "^18.2.0",
    "next": "^14.0.0",
    "typescript": "^5.0.0"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint ."
  },
  "keywords": [
    "markdown",
    "editor",
    "viewer",
    "live-preview"
  ]
}
```

---

## Bash / Shell

```bash
#!/bin/bash

# Variables
PROJECT_NAME="my-app"
BUILD_DIR="dist"
NODE_ENV="production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    exit 1
fi

print_message "Starting build process..."

# Clean build directory
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    print_message "Cleaned $BUILD_DIR directory"
fi

# Install dependencies
npm install || {
    print_error "Failed to install dependencies"
    exit 1
}

# Run build
NODE_ENV=$NODE_ENV npm run build || {
    print_error "Build failed"
    exit 1
}

print_message "Build completed successfully!"
```

---

## Go

```go
package main

import (
    "fmt"
    "net/http"
    "time"
)

// User struct
type User struct {
    ID        int       `json:"id"`
    Username  string    `json:"username"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
}

// Handler function
func helloHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello, World!")
}

// Method on User struct
func (u *User) GetFullInfo() string {
    return fmt.Sprintf("%s (%s) - ID: %d", u.Username, u.Email, u.ID)
}

func main() {
    // Create user
    user := User{
        ID:        1,
        Username:  "johndoe",
        Email:     "john@example.com",
        CreatedAt: time.Now(),
    }

    fmt.Println(user.GetFullInfo())

    // Set up HTTP server
    http.HandleFunc("/", helloHandler)
    
    fmt.Println("Server starting on :8080...")
    http.ListenAndServe(":8080", nil)
}
```

---

## Plain Text

```
This is plain text without syntax highlighting.
It's useful for showing output or configuration files.

Line 1
Line 2
Line 3

No special formatting or colors applied.
```

---

## Tips for Code Blocks

- Use triple backticks (```) to create code blocks
- Specify the language after opening backticks for syntax highlighting
- Supported languages: javascript, python, sql, html, css, json, bash, go, rust, java, php, and many more
- Use single backticks for inline code
- Code blocks preserve indentation and formatting

**Try it yourself**: Click inside any code block to see the raw markdown!