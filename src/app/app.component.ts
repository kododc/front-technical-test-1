import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type ItemId = string;

interface FileItem {
	id: ItemId;
	parentId: ItemId | null;
	name: string;
	folder: boolean;
	creation: string;
	modification: string;
	filePath?: string;
	mimeType?: string;
	size?: number;
}

interface ItemsResponse {
	items: FileItem[];
}

interface PathItem {
	id: string;
	name: string;
	folder: boolean;
}

@Component({
	selector: 'ic-root',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './app.component.html',
	styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
	private readonly apiBase = '/api';

	items: FileItem[] = [];
	path: PathItem[] = [{ id: 'root', name: 'Root', folder: true }];
	currentParentId: ItemId | null = null;
	loading = false;
	errorMessage = '';
	newFolderName = '';
	uploading = false;

	constructor(private readonly http: HttpClient) {}

	ngOnInit(): void {
		this.loadItems(null);
	}

	loadItems(parentId: ItemId | null): void {
		this.loading = true;
		this.errorMessage = '';
		this.currentParentId = parentId;

		let params = new HttpParams();
		if (parentId) {
			params = params.set('parentId', parentId);
		}

		this.http.get<ItemsResponse>(`${this.apiBase}/items`, { params }).subscribe({
			next: response => {
				this.items = response.items ?? [];
				this.loading = false;
				this.loadPath();
			},
			error: error => this.handleError(error, 'Unable to load items.'),
		});
	}

	loadPath(): void {
		if (!this.currentParentId) {
			this.path = [{ id: 'root', name: 'Root', folder: true }];
			return;
		}

		this.http
			.get<{ items: PathItem[] }>(`${this.apiBase}/items/${this.currentParentId}/path`)
			.subscribe({
				next: response => {
					this.path = response.items ?? [{ id: 'root', name: 'Root', folder: true }];
				},
				error: error => this.handleError(error, 'Unable to load path.'),
			});
	}

	navigateTo(item: PathItem): void {
		if (item.id === 'root') {
			this.loadItems(null);
			return;
		}

		this.loadItems(item.id);
	}

	openItem(item: FileItem): void {
		if (item.folder) {
			this.loadItems(item.id);
		} else {
			this.downloadItem(item);
		}
	}

	downloadItem(item: FileItem): void {
		this.errorMessage = '';
		this.http
			.get(`${this.apiBase}/items/${item.id}`, { responseType: 'blob' })
			.subscribe({
				next: blob => {
					const url = URL.createObjectURL(blob);
					const link = document.createElement('a');
					link.href = url;
					link.download = item.name;
					link.click();
					URL.revokeObjectURL(url);
				},
				error: error => this.handleError(error, 'Unable to download file.'),
			});
	}

	onUploadChange(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			return;
		}

		this.uploading = true;
		this.errorMessage = '';

		const formData = new FormData();
		formData.append('files', file);
		if (this.currentParentId) {
			formData.append('parentId', this.currentParentId);
		}

		this.http.post<FileItem>(`${this.apiBase}/items`, formData).subscribe({
			next: () => {
				this.uploading = false;
				input.value = '';
				this.loadItems(this.currentParentId);
			},
			error: error => {
				this.uploading = false;
				this.handleError(error, 'Unable to upload file.');
			},
		});
	}

	createFolder(): void {
		const trimmedName = this.newFolderName.trim();
		if (!trimmedName) {
			return;
		}

		this.errorMessage = '';
		const body = {
			name: trimmedName,
			folder: true,
			parentId: this.currentParentId,
		};

		this.http.post<FileItem>(`${this.apiBase}/items`, body).subscribe({
			next: () => {
				this.newFolderName = '';
				this.loadItems(this.currentParentId);
			},
			error: error => this.handleError(error, 'Unable to create folder.'),
		});
	}

	deleteItem(item: FileItem): void {
		this.errorMessage = '';
		this.http.delete(`${this.apiBase}/items/${item.id}`).subscribe({
			next: () => this.loadItems(this.currentParentId),
			error: error => this.handleError(error, 'Unable to delete item.'),
		});
	}

	formatSize(size?: number): string {
		if (!size) {
			return '-';
		}

		const units = ['B', 'KB', 'MB', 'GB'];
		let value = size;
		let unitIndex = 0;

		while (value >= 1024 && unitIndex < units.length - 1) {
			value /= 1024;
			unitIndex += 1;
		}

		return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	}

	private handleError(error: HttpErrorResponse, fallbackMessage: string): void {
		const apiMessage = (error.error && (error.error.desc || error.error.message)) || '';
		this.errorMessage = apiMessage ? `${fallbackMessage} ${apiMessage}` : fallbackMessage;
		this.loading = false;
	}
}
