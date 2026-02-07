# Mermaid Diagram Examples

All diagram types are supported including ER diagrams and Git graphs!

## Flowchart

```mermaid
graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> A
```

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant App
    participant API

    User->>App: Click button
    App->>API: Send request
    API-->>App: Return data
    App-->>User: Display result
```

## ER Diagram (Entity Relationship)

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
        string phone
    }
    ORDER {
        int orderNumber
        date orderDate
        string status
    }
    LINE-ITEM {
        string productCode
        int quantity
        float price
    }
    PRODUCT ||--o{ LINE-ITEM : "ordered in"
    PRODUCT {
        string code
        string name
        string description
        float price
    }
```

## Git Graph

```mermaid
gitGraph
    commit
    commit
    branch develop
    checkout develop
    commit
    commit
    checkout main
    merge develop
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    merge feature
    commit
```

## State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: Start
    Processing --> Success: Complete
    Processing --> Error: Fail
    Success --> [*]
    Error --> Idle: Retry
```

## Class Diagram

```mermaid
classDiagram
    class Animal {
        +String name
        +int age
        +makeSound()
    }
    class Dog {
        +String breed
        +bark()
    }
    class Cat {
        +String color
        +meow()
    }
    Animal <|-- Dog
    Animal <|-- Cat
```

## Pie Chart

```mermaid
pie title Programming Languages Usage
    "JavaScript" : 40
    "Python" : 30
    "TypeScript" : 20
    "Other" : 10
```

## Gantt Chart

```mermaid
gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements    :a1, 2024-01-01, 7d
    Design         :a2, after a1, 5d
    section Development
    Backend        :b1, after a2, 14d
    Frontend       :b2, after a2, 14d
    section Testing
    QA Testing     :c1, after b1, 7d
```
