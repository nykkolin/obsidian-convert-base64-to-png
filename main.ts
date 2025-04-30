import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath, base64ToArrayBuffer } from 'obsidian';

interface ConvertBase64ToPNGSettings {
	outputFolder: string;
	autoConvert: boolean;
	filenameFormat: string;
}

const DEFAULT_SETTINGS: ConvertBase64ToPNGSettings = {
	outputFolder: 'attachments',
	autoConvert: false,
	filenameFormat: 'image-{{date}}-{{index}}'
}

export default class ConvertBase64ToPNGPlugin extends Plugin {
	settings: ConvertBase64ToPNGSettings;

	async onload() {
		await this.loadSettings();

		// Add command to convert base64 images in current file
		this.addCommand({
			id: 'convert-base64-to-png-current-file',
			name: 'Convert Base64 images to PNG for current file',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.convertBase64ToPNG(editor, view.file);
			}
		});

		// Add command to convert base64 images in all files
		this.addCommand({
			id: 'convert-base64-to-png-all-files',
			name: 'Convert Base64 images to PNG for all files',
			callback: () => {
				this.convertAllFilesBase64ToPNG();
			}
		});

		// Add settings tab
		this.addSettingTab(new ConvertBase64ToPNGSettingTab(this.app, this));

		// Register event for auto-conversion if enabled
		if (this.settings.autoConvert) {
			this.registerEvent(
				this.app.workspace.on('editor-paste', (_: ClipboardEvent, editor: Editor) => {
					// Check if pasted content contains base64 image
					setTimeout(() => {
						const content = editor.getValue();
						if (this.containsBase64Image(content)) {
							this.convertBase64ToPNG(editor, this.app.workspace.getActiveFile());
						}
					}, 100);
				})
			);
		}
	}

	onunload() {
		// Clean up any resources
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Check if content contains base64 image
	containsBase64Image(content: string): boolean {
		const base64Regex = /!\[.*?\]\(data:image\/[a-zA-Z]+;base64,([^)]+)\)/g;
		return base64Regex.test(content);
	}

	// Convert base64 images in current file
	async convertCurrentFileBase64ToPNG() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			const editor = activeView.editor;
			const file = activeView.file;
			await this.convertBase64ToPNG(editor, file);
		} else {
			new Notice('No active markdown file');
		}
	}

	// Main conversion function
	async convertBase64ToPNG(editor: Editor, file: TFile | null) {
		if (!file) {
			new Notice('No file is currently open');
			return;
		}

		const content = editor.getValue();
		const base64Regex = /!\[(.*?)\]\(data:image\/([a-zA-Z]+);base64,([^)]+)\)/g;

		let match;
		let newContent = content;
		let conversionCount = 0;
		const matches = [];

		// Find all matches first
		while ((match = base64Regex.exec(content)) !== null) {
			matches.push({
				fullMatch: match[0],
				altText: match[1],
				imageType: match[2],
				base64Data: match[3]
			});
		}

		if (matches.length === 0) {
			new Notice('No base64 images found in the current file');
			return;
		}

		// Create output folder if it doesn't exist
		const filePath = file.path;
		const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
		const outputFolderPath = normalizePath(`${fileDir}/${this.settings.outputFolder}`);

		try {
			await this.app.vault.adapter.mkdir(outputFolderPath);
		} catch (error) {
			// Folder might already exist, which is fine
		}

		// Process each match
		for (let i = 0; i < matches.length; i++) {
			const match = matches[i];

			try {
				// Generate filename
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
				const filename = this.settings.filenameFormat
					.replace('{{date}}', timestamp)
					.replace('{{index}}', (i + 1).toString())
					.replace('{{type}}', match.imageType) + '.png';

				const imagePath = normalizePath(`${outputFolderPath}/${filename}`);
				const relativeImagePath = normalizePath(`${this.settings.outputFolder}/${filename}`);

				// 使用Obsidian API提供的base64ToArrayBuffer
				const binaryData = base64ToArrayBuffer(match.base64Data);
				await this.app.vault.adapter.writeBinary(imagePath, binaryData);

				// Replace in content
				const newImageMarkdown = `![${match.altText}](${relativeImagePath})`;
				newContent = newContent.replace(match.fullMatch, newImageMarkdown);

				conversionCount++;
			} catch (error) {
				console.error('Error converting base64 to PNG:', error);
				new Notice(`Error converting image ${i + 1}: ${error.message}`);
			}
		}

		// Update the file content
		editor.setValue(newContent);

		new Notice(`Converted ${conversionCount} base64 image${conversionCount !== 1 ? 's' : ''} to PNG`);
	}

	// Convert base64 images in all markdown files
	async convertAllFilesBase64ToPNG() {
		const files = this.app.vault.getMarkdownFiles();
		let totalConversions = 0;
		let processedFiles = 0;

		new Notice(`Processing ${files.length} files...`);

		for (const file of files) {
			try {
				// Get file content
				const content = await this.app.vault.read(file);

				// Check if file contains base64 images
				if (this.containsBase64Image(content)) {
					// Count base64 images in the file
					const base64Regex = /!\[(.*?)\]\(data:image\/([a-zA-Z]+);base64,([^)]+)\)/g;
					let matches = [];
					let match;
					while ((match = base64Regex.exec(content)) !== null) {
						matches.push(match);
					}

					// Process the file directly instead of using the editor-based function
					let newContent = content;
					let fileConversionCount = 0;

					// Create output folder if it doesn't exist
					const filePath = file.path;
					const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
					const outputFolderPath = normalizePath(`${fileDir}/${this.settings.outputFolder}`);

					try {
						await this.app.vault.adapter.mkdir(outputFolderPath);
					} catch (error) {
						// Folder might already exist, which is fine
					}

					// Process each match
					for (let i = 0; i < matches.length; i++) {
						const match = {
							fullMatch: matches[i][0],
							altText: matches[i][1],
							imageType: matches[i][2],
							base64Data: matches[i][3]
						};

						try {
							// Generate filename
							const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
							const filename = this.settings.filenameFormat
								.replace('{{date}}', timestamp)
								.replace('{{index}}', (i + 1).toString())
								.replace('{{type}}', match.imageType) + '.png';

							const imagePath = normalizePath(`${outputFolderPath}/${filename}`);
							const relativeImagePath = normalizePath(`${this.settings.outputFolder}/${filename}`);

							// 使用Obsidian API提供的base64ToArrayBuffer
							const binaryData = base64ToArrayBuffer(match.base64Data);
							await this.app.vault.adapter.writeBinary(imagePath, binaryData);

							// Replace in content
							const newImageMarkdown = `![${match.altText}](${relativeImagePath})`;
							newContent = newContent.replace(match.fullMatch, newImageMarkdown);

							fileConversionCount++;
						} catch (error) {
							console.error(`Error converting image in file ${file.path}:`, error);
						}
					}

					// Update the file content
					if (fileConversionCount > 0) {
						await this.app.vault.modify(file, newContent);
					}

					totalConversions += fileConversionCount;
				}

				processedFiles++;
				if (processedFiles % 10 === 0) {
					new Notice(`Processed ${processedFiles}/${files.length} files...`);
				}
			} catch (error) {
				console.error(`Error processing file ${file.path}:`, error);
				new Notice(`Error processing file ${file.path}: ${error.message}`);
			}
		}

		new Notice(`Completed! Converted ${totalConversions} base64 image${totalConversions !== 1 ? 's' : ''} across ${files.length} files.`);
	}
}

class ConvertBase64ToPNGSettingTab extends PluginSettingTab {
	plugin: ConvertBase64ToPNGPlugin;

	constructor(app: App, plugin: ConvertBase64ToPNGPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Folder where PNG files will be saved (relative to the note)')
			.addText(text => text
				.setPlaceholder('attachments')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto convert')
			.setDesc('Automatically convert base64 images when pasting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConvert)
				.onChange(async (value) => {
					this.plugin.settings.autoConvert = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename format')
			.setDesc('Format for generated filenames. Available placeholders: {{date}}, {{index}}, {{type}}')
			.addText(text => text
				.setPlaceholder('image-{{date}}-{{index}}')
				.setValue(this.plugin.settings.filenameFormat)
				.onChange(async (value) => {
					this.plugin.settings.filenameFormat = value;
					await this.plugin.saveSettings();
				}));

		// Sponsor section
		containerEl.createEl('hr');

		const sponsorDiv = containerEl.createDiv('sponsor-container');

		const sponsorText = sponsorDiv.createDiv('sponsor-text');
		sponsorText.setText('If you like this Plugin, consider donating to support continued development.');

		const buttonsDiv = sponsorDiv.createDiv('sponsor-buttons');

		// Ko-fi button
		const kofiLink = buttonsDiv.createEl('a', {
			href: 'https://ko-fi.com/nykkolin'
		});
		kofiLink.setAttribute('target', '_blank');
		kofiLink.setAttribute('rel', 'noopener');

		// Embed SVG directly instead of using external file
		kofiLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="38" viewBox="0 0 82.25 28" role="img" aria-label="KO-FI" class="sponsor-image"><title>KO-FI</title><g shape-rendering="crispEdges"><rect width="82.25" height="28" fill="#f16061"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100"><image x="9" y="7" width="14" height="14" href="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHRpdGxlPktvLWZpPC90aXRsZT48cGF0aCBkPSJNMTEuMzUxIDIuNzE1Yy0yLjcgMC00Ljk4Ni4wMjUtNi44My4yNkMyLjA3OCAzLjI4NSAwIDUuMTU0IDAgOC42MWMwIDMuNTA2LjE4MiA2LjEzIDEuNTg1IDguNDkzIDEuNTg0IDIuNzAxIDQuMjMzIDQuMTgyIDcuNjYyIDQuMTgyaC44M2M0LjIwOSAwIDYuNDk0LTIuMjM0IDcuNjM3LTRhOS41IDkuNSAwIDAgMCAxLjA5MS0yLjMzOEMyMS43OTIgMTQuNjg4IDI0IDEyLjIyIDI0IDkuMjA4di0uNDE1YzAtMy4yNDctMi4xMy01LjUwNy01Ljc5Mi01Ljg3LTEuNTU4LS4xNTYtMi42NS0uMjA4LTYuODU3LS4yMDhtMCAxLjk0N2M0LjIwOCAwIDUuMDkuMDUyIDYuNTcxLjE4MiAyLjYyNC4zMTEgNC4xMyAxLjU4NCA0LjEzIDR2LjM5YzAgMi4xNTYtMS43OTIgMy44NDQtMy44NyAzLjg0NGgtLjkzNWwtLjE1Ni42NDljLS4yMDggMS4wMTMtLjU5NyAxLjgxOC0xLjAzOSAyLjU0Ni0uOTA5IDEuNDI4LTIuNTQ1IDMuMDY0LTUuOTIyIDMuMDY0aC0uODA1Yy0yLjU3MSAwLTQuODMxLS44ODMtNi4wNzgtMy4xOTUtMS4wOS0yLTEuMjk4LTQuMTU1LTEuMjk4LTcuNTA2IDAtMi4xODEuODU3LTMuNDAyIDMuMDEyLTMuNzE0IDEuNTMzLS4yMzMgMy41NTktLjI2IDYuMzktLjI2bTYuNTQ3IDIuMjg3Yy0uNDE2IDAtLjY1LjIzNC0uNjUuNTQ2djIuOTM1YzAgLjMxMS4yMzQuNTQ1LjY1LjU0NSAxLjMyNCAwIDIuMDUxLS43NTQgMi4wNTEtMnMtLjcyNy0yLjAyNi0yLjA1Mi0yLjAyNm0tMTAuMzkuMTgyYy0xLjgxOCAwLTMuMDEzIDEuNDgtMy4wMTMgMy4xNDIgMCAxLjUzMy44NTggMi44NTcgMS45NDkgMy44OTcuNzI3LjcwMSAxLjg3IDEuNDI5IDIuNjQ5IDEuODk2YTEuNDcgMS40NyAwIDAgMCAxLjUwNyAwYy43OC0uNDY3IDEuOTIyLTEuMTk1IDIuNjIzLTEuODk2IDEuMTE3LTEuMDM5IDEuOTc0LTIuMzY0IDEuOTc0LTMuODk3IDAtMS42NjItMS4yNDctMy4xNDItMy4wMzktMy4xNDItMS4wNjUgMC0xLjc5Mi41NDUtMi4zMzggMS4yOTgtLjQ5My0uNzUzLTEuMjQ2LTEuMjk4LTIuMzEyLTEuMjk4Ii8+PC9zdmc+"/><text transform="scale(.1)" x="511.25" y="175" textLength="382.5" fill="#fff" font-weight="bold">KO-FI</text></g></svg>`;

		// Buy Me a Coffee button
		const bmcLink = buttonsDiv.createEl('a', {
			href: 'https://www.buymeacoffee.com/xmasterdev'
		});
		bmcLink.setAttribute('target', '_blank');
		bmcLink.setAttribute('rel', 'noopener');

		// Embed SVG directly instead of using external file
		bmcLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="38" viewBox="0 0 217 60" class="sponsor-image">
  <!-- Background -->
  <rect width="217" height="60" rx="12" fill="#FFDD00"/>
  <!-- Coffee cup emoji -->
  <text x="19" y="42" font-size="30">☕️</text>
  <!-- "Buy me a coffee" text -->
  <text x="59" y="39" font-family="'Brush Script MT', 'Comic Sans MS', cursive" font-size="28" font-weight="normal" fill="#000000" font-style="italic">Buy me a coffee</text>
</svg>`;
	}
}
