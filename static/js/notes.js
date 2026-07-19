class Notes {
    constructor() {
        this.notesData = [];
        this.currentTags = [];
        this.editingNoteId = null;
        this.deletingNoteId = null;
        this.toastTimeout = null;
        this.initializeElements();
        this.attachEventListeners();
        this.initTheme();
        this.loadNotes();
    }

    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.refreshBtn = document.getElementById('refreshNotesBtn');
        this.addNoteBtn = document.getElementById('addNoteBtn');
        this.clearAllBtn = document.getElementById('clearAllNotesBtn');
        this.exportBtn = document.getElementById('exportNotesBtn');
        this.themeToggle = document.getElementById('themeToggle');
        this.notesGrid = document.getElementById('notesGrid');
        this.resultsCount = document.getElementById('resultsCount');
        this.totalNotes = document.getElementById('totalNotes');
        this.totalTags = document.getElementById('totalTags');
        this.recentNote = document.getElementById('recentNote');
        
        // Modals
        this.noteModal = document.getElementById('noteModal');
        this.deleteModal = document.getElementById('deleteModal');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteContent = document.getElementById('noteContent');
        this.tagInput = document.getElementById('tagInput');
        this.tagsContainer = document.getElementById('tagsContainer');
        this.noteModalTitle = document.getElementById('noteModalTitle');
        this.saveNoteBtn = document.getElementById('saveNoteBtn');
    }

    attachEventListeners() {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.renderNotes());
        }
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => {
                this.loadNotes();
                this.showToast('Notes refreshed!', 'success');
            });
        }
        if (this.addNoteBtn) {
            this.addNoteBtn.addEventListener('click', () => this.openAddNoteModal());
        }
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => this.clearAllNotes());
        }
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportNotes());
        }
        if (this.themeToggle) {
            this.themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        if (this.noteModal) {
            this.noteModal.addEventListener('click', (e) => {
                if (e.target === this.noteModal) this.closeNoteModal();
            });
        }
        if (this.deleteModal) {
            this.deleteModal.addEventListener('click', (e) => {
                if (e.target === this.deleteModal) this.closeDeleteModal();
            });
        }
        if (this.saveNoteBtn) {
            this.saveNoteBtn.addEventListener('click', () => this.saveNote());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeNoteModal();
                this.closeDeleteModal();
            }
        });
        // Tag input enter key
        if (this.tagInput) {
            this.tagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addTag();
            });
        }
        // Listen for duration changes from other pages
        window.addEventListener('storage', (e) => {
            if (e.key === 'durationChanged' || e.key === 'selectedDuration') {
                // Notes don't depend on duration, but we can show a notification
                this.showToast('Duration updated from dashboard', 'info');
            }
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
        this.renderNotes();
    }

    updateThemeIcon(theme) {
        if (this.themeToggle) {
            const icon = this.themeToggle.querySelector('i');
            const span = this.themeToggle.querySelector('span');
            if (theme === 'dark') {
                icon.className = 'fas fa-sun';
                span.textContent = 'Light Mode';
            } else {
                icon.className = 'fas fa-moon';
                span.textContent = 'Dark Mode';
            }
        }
    }

    getNotes() {
        try {
            const data = localStorage.getItem('userNotes');
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    saveNotes(notes) {
        localStorage.setItem('userNotes', JSON.stringify(notes));
    }

    loadNotes() {
        this.notesData = this.getNotes();
        this.renderNotes();
    }

    renderNotes() {
        const searchTerm = this.searchInput ? this.searchInput.value.toLowerCase().trim() : '';
        let filtered = this.notesData;
        
        if (searchTerm) {
            filtered = filtered.filter(note => 
                (note.title && note.title.toLowerCase().includes(searchTerm)) ||
                (note.content && note.content.toLowerCase().includes(searchTerm)) ||
                (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
            );
        }
        
        this.updateStats(filtered);
        this.displayNotes(filtered);
        if (this.resultsCount) {
            this.resultsCount.textContent = `${filtered.length} notes`;
        }
    }

    updateStats(notes) {
        const total = notes.length;
        if (this.totalNotes) this.totalNotes.textContent = total;
        
        if (total === 0) {
            if (this.totalTags) this.totalTags.textContent = '0';
            if (this.recentNote) this.recentNote.textContent = 'N/A';
            return;
        }
        
        const allTags = new Set();
        notes.forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => allTags.add(tag));
            }
        });
        if (this.totalTags) this.totalTags.textContent = allTags.size;
        
        const sorted = [...notes].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
        const recent = sorted[0];
        if (this.recentNote) this.recentNote.textContent = recent.title || 'Untitled';
    }

    displayNotes(notes) {
        if (!this.notesGrid) return;
        
        if (notes.length === 0) {
            this.notesGrid.innerHTML = `
                <div class="notes-empty">
                    <span class="empty-icon">
                        <i class="fas fa-sticky-note"></i>
                    </span>
                    <h3>No Notes Yet</h3>
                    <p>Start taking notes for stocks you're interested in. Add titles, content, and tags to organize your thoughts.</p>
                    <button class="btn-primary" onclick="window.notes.openAddNoteModal()">
                        <i class="fas fa-plus"></i> Create Your First Note
                    </button>
                </div>
            `;
            return;
        }

        let html = '';
        notes.forEach((note, index) => {
            const date = note.updated_at ? new Date(note.updated_at).toLocaleDateString() : 'N/A';
            
            html += `
                <div class="note-card" data-note-index="${index}">
                    <div class="note-card-header">
                        <div class="note-title" onclick="window.notes.openEditNoteModal(${index})">${note.title || 'Untitled'}</div>
                        <div class="note-date">${date}</div>
                    </div>
                    <div class="note-card-body">
                        <div class="note-content" onclick="window.notes.openEditNoteModal(${index})">
                            ${note.content || 'No content'}
                        </div>
                        ${note.tags && note.tags.length > 0 ? `
                            <div class="note-tags">
                                ${note.tags.map(tag => `
                                    <span class="note-tag ${tag.toLowerCase().includes('stock') ? 'stock-tag' : ''}">#${tag}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="note-card-actions">
                        <button class="btn-sm btn-edit" onclick="window.notes.openEditNoteModal(${index})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-sm btn-delete" onclick="window.notes.openDeleteModal(${index})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        this.notesGrid.innerHTML = html;
    }

    openAddNoteModal() {
        this.editingNoteId = null;
        this.currentTags = [];
        if (this.noteModalTitle) this.noteModalTitle.textContent = 'Add New Note';
        if (this.noteTitle) this.noteTitle.value = '';
        if (this.noteContent) this.noteContent.value = '';
        if (this.tagInput) this.tagInput.value = '';
        if (this.saveNoteBtn) {
            this.saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> Save Note';
        }
        this.renderTags();
        if (this.noteModal) this.noteModal.classList.add('show');
    }

    openEditNoteModal(index) {
        const note = this.notesData[index];
        if (!note) return;
        
        this.editingNoteId = index;
        this.currentTags = note.tags || [];
        if (this.noteModalTitle) this.noteModalTitle.textContent = 'Edit Note';
        if (this.noteTitle) this.noteTitle.value = note.title || '';
        if (this.noteContent) this.noteContent.value = note.content || '';
        if (this.tagInput) this.tagInput.value = '';
        if (this.saveNoteBtn) {
            this.saveNoteBtn.innerHTML = '<i class="fas fa-save"></i> Update Note';
        }
        this.renderTags();
        if (this.noteModal) this.noteModal.classList.add('show');
    }

    closeNoteModal() {
        if (this.noteModal) this.noteModal.classList.remove('show');
        this.editingNoteId = null;
        this.currentTags = [];
    }

    openDeleteModal(index) {
        this.deletingNoteId = index;
        if (this.deleteModal) this.deleteModal.classList.add('show');
    }

    closeDeleteModal() {
        if (this.deleteModal) this.deleteModal.classList.remove('show');
        this.deletingNoteId = null;
    }

    confirmDelete() {
        if (this.deletingNoteId === null) return;
        
        const notes = this.getNotes();
        notes.splice(this.deletingNoteId, 1);
        this.saveNotes(notes);
        this.closeDeleteModal();
        this.loadNotes();
        this.showToast('Note deleted successfully!', 'success');
        this.deletingNoteId = null;
    }

    addTag() {
        if (!this.tagInput) return;
        const tag = this.tagInput.value.trim();
        if (tag && !this.currentTags.includes(tag)) {
            this.currentTags.push(tag);
            this.renderTags();
            this.tagInput.value = '';
        }
    }

    removeTag(tag) {
        this.currentTags = this.currentTags.filter(t => t !== tag);
        this.renderTags();
    }

    renderTags() {
        if (!this.tagsContainer) return;
        if (this.currentTags.length === 0) {
            this.tagsContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-light);">No tags added</span>';
            return;
        }
        this.tagsContainer.innerHTML = this.currentTags.map(tag => `
            <span class="tag-item">
                #${tag}
                <span class="remove-tag" onclick="window.notes.removeTag('${tag}')">&times;</span>
            </span>
        `).join('');
    }

    saveNote() {
        if (!this.noteTitle || !this.noteContent) return;
        
        const title = this.noteTitle.value.trim();
        const content = this.noteContent.value.trim();
        
        if (!title && !content) {
            this.showToast('Please add a title or content', 'warning');
            return;
        }
        
        const notes = this.getNotes();
        const noteData = {
            title: title || 'Untitled',
            content: content || '',
            tags: this.currentTags,
            updated_at: new Date().toISOString()
        };
        
        if (this.editingNoteId !== null) {
            notes[this.editingNoteId] = { ...notes[this.editingNoteId], ...noteData };
            this.showToast('Note updated successfully!', 'success');
        } else {
            noteData.created_at = new Date().toISOString();
            notes.push(noteData);
            this.showToast('Note added successfully!', 'success');
        }
        
        this.saveNotes(notes);
        this.closeNoteModal();
        this.loadNotes();
    }

    clearAllNotes() {
        if (this.notesData.length === 0) {
            this.showToast('No notes to clear', 'warning');
            return;
        }
        
        if (!confirm('Are you sure you want to delete all notes?')) return;
        
        this.saveNotes([]);
        this.loadNotes();
        this.showToast('All notes cleared!', 'success');
    }

    exportNotes() {
        if (this.notesData.length === 0) {
            this.showToast('No notes to export', 'warning');
            return;
        }
        
        let csv = 'Title,Content,Tags,Updated At\n';
        this.notesData.forEach(note => {
            const tags = note.tags ? note.tags.join('; ') : '';
            csv += `"${note.title || 'Untitled'}","${note.content || ''}","${tags}","${note.updated_at || ''}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Notes exported successfully!', 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast || !toastMessage) { alert(message); return; }
        
        toast.className = 'toast';
        const icon = toast.querySelector('.toast-icon');
        if (type === 'success') {
            toast.classList.add('toast-success');
            if (icon) icon.className = 'fas fa-check-circle toast-icon';
        } else if (type === 'error') {
            toast.classList.add('toast-error');
            if (icon) icon.className = 'fas fa-exclamation-circle toast-icon';
        } else if (type === 'warning') {
            toast.classList.add('toast-warning');
            if (icon) icon.className = 'fas fa-exclamation-triangle toast-icon';
        }
        
        toastMessage.textContent = message;
        toast.style.display = 'flex';
        clearTimeout(this.toastTimeout);
        this.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.notes = new Notes();
});