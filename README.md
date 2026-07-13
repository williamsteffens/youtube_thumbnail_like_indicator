# YouTube Like Indicator

A lightweight browser extension that displays whether you've **liked a YouTube video directly on its thumbnail**, making it easy to recognize videos you've already enjoyed while browsing.

## Features

* Displays a visual indicator on YouTube video thumbnails.
* Works across common YouTube pages:

  * Home
  * Search results
  * Related videos
  * Subscriptions
  * Channel pages
* Automatically updates as YouTube loads new content.
* Lightweight with minimal impact on browsing performance.
* Your data stays local unless you choose to enable YouTube API integration.

## Preview

> *Screenshots and GIFs coming soon.*

## How It Works

The extension scans YouTube for video thumbnails, extracts each video's ID, determines whether the video has been liked, and overlays a small badge on the thumbnail.

```
YouTube Page
      |
      v
Find Video Thumbnails
      │
      v
Extract Video IDs
      │
      v
Check Like Status
      │
      v
Display Badge on Thumbnail
```

## Project Structure

```
youtube-like-indicator/
├── manifest.json
├── content.js          # Detects video thumbnails and injects indicators
├── background.js       # Handles API/authentication (optional)
├── styles.css          # Badge styling
├── utils.js            # Shared helper functions
├── icons/
└── README.md
```

## Installation

### Get the Extension at the ...
packaged with web-ext
link:


### If You Want to Load it as an Unpacked Extension

1. Clone the repository.

```bash
git clone https://github.com/yourusername/youtube-like-indicator.git
```

2. Open your browser's extensions page.
3. Enable **Developer Mode**.
4. Click **Load unpacked**.
5. Select the project folder.

## Roadmap

* [ ] Badge on all YouTube video cards
* [ ] Automatic detection of dynamically loaded videos
* [ ] OAuth authentication
* [ ] YouTube Data API integration
* [ ] Local caching for faster performance
* [ ] Customizable badge styles
* [ ] Dark and light mode support
* [ ] Firefox support
* [ ] Edge support

## Tech Stack

* JavaScript (ES6+)
* Chrome Extension Manifest V3
* HTML
* CSS

## Contributing

Contributions, feature requests, and bug reports are welcome!

If you'd like to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Open a pull request.

## License

This project is licensed under the MIT License.
