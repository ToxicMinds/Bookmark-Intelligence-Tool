const tree = [
  {
    "id": "0",
    "children": [
      {
        "id": "1",
        "title": "Bookmarks bar",
        "children": [
          { "id": "11", "title": "Direct Bookmark", "url": "http://direct.com" },
          {
            "id": "12",
            "title": "AWS",
            "children": [
              { "id": "121", "title": "AWS Console", "url": "http://aws.com" },
              { "id": "122", "title": "AWS Docs", "url": "http://aws.docs.com" },
              { "id": "123", "title": "AWS Third", "url": "http://aws.third.com" }
            ]
          },
          {
            "id": "13",
            "title": "Dev",
            "children": [
              {
                "id": "131",
                "title": "React",
                "children": [
                  { "id": "1311", "title": "React Docs", "url": "http://react.com" }
                ]
              }
            ]
          }
        ]
      },
      {
        "id": "2",
        "title": "Other bookmarks",
        "children": [
          { "id": "21", "title": "Other URL", "url": "http://other.com" }
        ]
      }
    ]
  }
];

const flat = [];
const ROOT_SKIP = new Set(['Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Other Bookmarks', 'Mobile bookmarks', 'Mobile Bookmarks', '']);

function walk(nodes, pathSegments = []) {
  for (const node of nodes) {
    if (node.url) {
      const folderPath = pathSegments.filter(Boolean).join(' / ') || 'Imported';
      flat.push({ url: node.url, title: node.title || node.url, folder: folderPath });
    }
    if (node.children) {
      const shouldAddToPath = node.title && !ROOT_SKIP.has(node.title);
      // BUG WAS PROBABLY HERE:
      walk(node.children, shouldAddToPath ? [...pathSegments, node.title] : pathSegments);
    }
  }
}

if (tree[0]?.children) {
  for (const topLevel of tree[0].children) {
    if (topLevel.children) {
      walk(topLevel.children, ROOT_SKIP.has(topLevel.title) ? [] : [topLevel.title]);
    } else if (topLevel.url) {
      flat.push({ url: topLevel.url, title: topLevel.title || topLevel.url, folder: 'Imported' });
    }
  }
}

console.log(JSON.stringify(flat, null, 2));
