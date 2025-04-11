# Convert Base64 to PNG

This plugin for [Obsidian](https://obsidian.md) converts base64-encoded images in your notes to local PNG files. Reduce the size of your markdown files and make them more portable!

## Demo
![Demo](screenshots/demo.gif)

## Features

- **Base64 Detection**: Automatically detects base64-encoded images in your notes
- **Local Conversion**: Converts base64 images to local PNG files
- **Batch Processing**: Process individual files or all files in your vault
- **Customizable Storage**: Configure where and how PNG files are stored
- **Automatic Conversion**: Option to automatically convert base64 images when pasting

## How It Works

When you run the plugin:

1. It scans your notes for base64-encoded images
2. Decodes the base64 data to binary
3. Saves the binary data as PNG files in your configured folder
4. Updates the links in your notes to point to the local PNG files

This makes your notes smaller, more portable, and easier to work with.



## Settings

### General Settings

- **Auto Convert**: Automatically convert base64 images when pasting
- **Output Folder**: Folder where PNG files will be saved (relative to the note)
- **Filename Format**: Format for generated filenames with placeholders for date, index, and image type

## Commands

- **Convert Base64 images to PNG for current file**: Process the currently active file
- **Convert Base64 images to PNG for all files**: Process all markdown files in the vault

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to Community Plugins
3. Search for "Convert Base64 to PNG"
4. Click Install, then Enable

## Use Cases

- **Reduce File Size**: Base64-encoded images can make your markdown files very large
- **Improve Portability**: Local PNG files are more portable and can be used outside of Obsidian
- **Better Organization**: Keep your images in a dedicated folder instead of embedded in your notes
- **Easier Editing**: Smaller markdown files are easier to edit and work with

---

<div align="center">
  <p>If you find this plugin useful, consider supporting me:</p>
  <a href="https://www.buymeacoffee.com/xmasterdev" target="_blank">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;">
  </a>
  <p>or</p>
  <a href="https://ko-fi.com/nykkolin" target="_blank">
    <img src="https://img.shields.io/badge/Support%20me%20on-Ko--fi-blue?style=for-the-badge&logo=ko-fi" alt="Support me on Ko-fi">
  </a>
</div>
