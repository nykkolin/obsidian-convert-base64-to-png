import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile, normalizePath } from 'obsidian';

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

	// Helper method to convert base64 to binary data
	base64ToBinary(base64: string): ArrayBuffer {
		const binaryString = window.atob(base64);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
	}

	async onload() {
		await this.loadSettings();

		// Add ribbon icon
		const ribbonIconEl = this.addRibbonIcon('image-file', 'Convert Base64 to PNG', (_: MouseEvent) => {
			this.convertCurrentFileBase64ToPNG();
		});
		ribbonIconEl.addClass('convert-base64-to-png-ribbon-class');

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

				// Decode and save the image
				const binaryData = this.base64ToBinary(match.base64Data);
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

							// Decode and save the image
							const binaryData = this.base64ToBinary(match.base64Data);
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
		containerEl.createEl('h2', {text: 'Convert Base64 to PNG Settings'});

		new Setting(containerEl)
			.setName('Output Folder')
			.setDesc('Folder where PNG files will be saved (relative to the note)')
			.addText(text => text
				.setPlaceholder('attachments')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Convert')
			.setDesc('Automatically convert base64 images when pasting')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConvert)
				.onChange(async (value) => {
					this.plugin.settings.autoConvert = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename Format')
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

		// Create an image element for Ko-fi
		const kofiImg = kofiLink.createEl('img', { cls: 'sponsor-image' });
		kofiImg.src = 'https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white';
		kofiImg.alt = 'Support me on Ko-fi';

		// Buy Me a Coffee button
		const bmcLink = buttonsDiv.createEl('a', {
			href: 'https://www.buymeacoffee.com/xmasterdev'
		});
		bmcLink.setAttribute('target', '_blank');
		bmcLink.setAttribute('rel', 'noopener');

		// Create an image element for Buy Me a Coffee
		const bmcImg = bmcLink.createEl('img', { cls: 'sponsor-image' });
		bmcImg.src = 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png';
		bmcImg.alt = 'Buy Me A Coffee';
	}
}
