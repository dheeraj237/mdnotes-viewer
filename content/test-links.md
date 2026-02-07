# Test Link Navigation

This file tests relative markdown link navigation.

## Test Links

### Same Directory Links
- [Basic Formatting](./01-basic-formatting.md) - Link to file in same directory
- [Lists and Tasks](01-lists-and-tasks.md) - Link without ./  prefix

### Subdirectory Links
- [Test Content in subfolder](./content1/test-content.md) - Link to nested file
- [Topics Overview](topics/topics.md) - Link without ./ prefix

### Parent Directory Links
- These would need a parent directory to test
- Example: `[File](../other-folder/file.md)`

### Answer Files in Topics
- [Distributed Metrics](./topics/answers/01-distributed-metrics-logging.md)
- [Performance Metrics](topics/answers/02-performance-metrics-collection.md)

## Test Different Link Formats

Standard markdown link: [Code Blocks](./03-code-blocks.md)

Wiki-style link (if supported): [[01-basic-formatting]]

External link: [Google](https://www.google.com)

## Instructions

To test:
1. Cmd/Ctrl + Click on any markdown file link to open it in a new tab
2. External links should open in a new browser tab
3. If a file is not found, you should see an error alert
