/*
 * Sync Meter - Obsidian Plugin
 * 在狀態列顯示 Obsidian Sync 的即時同步進度百分比
 */

const { Plugin, setIcon } = require('obsidian');

class SyncMeterPlugin extends Plugin {
	async onload() {
		this.statusBarEl = this.addStatusBarItem();
		this.statusBarEl.addClass('sync-meter-status');
		this.statusBarEl.setAttribute('aria-label', 'Sync 進度');

		this.batchTotal = 0;

		this.updateStatus();
		this.registerInterval(
			window.setInterval(() => this.updateStatus(), 2000)
		);
	}

	// ─── Sync API 存取 ───

	getSyncInstance() {
		try {
			const sp = this.app.internalPlugins.getPluginById('sync');
			return sp?.enabled ? (sp.instance ?? null) : null;
		} catch {
			return null;
		}
	}

	getPendingCount(sync) {
		// 嘗試多種 internal API 路徑（未公開，需防禦性存取）
		if (Array.isArray(sync.queue)) return sync.queue.length;
		if (typeof sync.pending === 'number') return sync.pending;
		if (typeof sync.pendingSync === 'number') return sync.pendingSync;

		const ss = sync.syncStatus;
		if (ss) {
			if (typeof ss.pending === 'number') return ss.pending;
			if (typeof ss.total === 'number' && typeof ss.done === 'number') {
				return ss.total - ss.done;
			}
		}

		// 嘗試解析狀態文字
		const msg = sync.statusMessage
			?? (typeof sync.getStatusText === 'function' ? sync.getStatusText() : '');
		if (typeof msg === 'string' && msg.length > 0) {
			if (/synced|fully synced|已同步|完成/i.test(msg)) return 0;
			const m = msg.match(/(\d+)\s*(file|item|個|檔)/i);
			if (m) return parseInt(m[1]);
		}

		// 只知道正在同步但不知數量
		if (sync.syncing || sync.syncInProgress || sync.syncRunning) return -1;

		return 0;
	}

	// ─── 狀態更新 ───

	updateStatus() {
		const sync = this.getSyncInstance();
		if (!sync) {
			this.render(-1, 'off');
			return;
		}

		const pending = this.getPendingCount(sync);

		if (pending < 0) {
			this.render(-1, 'syncing');
			return;
		}

		if (pending > this.batchTotal) {
			this.batchTotal = pending;
		}

		if (pending === 0) {
			this.batchTotal = 0;
			this.render(100, 'done');
		} else {
			const pct = this.batchTotal > 0
				? Math.round(((this.batchTotal - pending) / this.batchTotal) * 100)
				: 0;
			this.render(pct, 'syncing');
		}
	}

	// ─── 渲染 ───

	render(pct, state) {
		const el = this.statusBarEl;
		el.empty();
		el.className = 'sync-meter-status';
		el.addClass(`sync-meter-${state}`);

		const icon = el.createSpan({ cls: 'sync-meter-icon' });
		setIcon(icon, 'cloud');

		if (state === 'off') {
			el.createSpan({ text: '--', cls: 'sync-meter-text' });
		} else if (pct < 0) {
			const track = el.createDiv({ cls: 'sync-meter-bar-track' });
			track.createDiv({ cls: 'sync-meter-bar-fill sync-meter-bar-indeterminate' });
			el.createSpan({ text: '...', cls: 'sync-meter-text' });
		} else {
			const track = el.createDiv({ cls: 'sync-meter-bar-track' });
			const fill = track.createDiv({ cls: 'sync-meter-bar-fill' });
			fill.style.width = `${pct}%`;
			el.createSpan({ text: `${pct}%`, cls: 'sync-meter-text' });
		}
	}

	onunload() {}
}

module.exports = SyncMeterPlugin;
