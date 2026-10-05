// ── Job Tracker (F11) ──
// Floating panel showing child processes of all terminal PTYs

let modalEl = null;
let isOpen = false;
let pollInterval = null;
let getTerminalsFn = null;

function init(opts) {
  getTerminalsFn = opts.getTerminals;

  modalEl = document.getElementById('job-tracker-modal');
  if (!modalEl) {
    modalEl = document.createElement('div');
    modalEl.id = 'job-tracker-modal';
    document.body.appendChild(modalEl);
  }
}

function open() {
  if (isOpen) return;
  isOpen = true;
  render([]);
  modalEl.classList.add('open');
  pollAndRender();
  pollInterval = setInterval(pollAndRender, 3000);
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  modalEl.classList.remove('open');
  modalEl.innerHTML = '';
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function toggle() {
  if (isOpen) close();
  else open();
}

async function pollAndRender() {
  if (!getTerminalsFn || !window.terminalAPI) return;
  const terminalIds = getTerminalsFn();
  const allJobs = [];

  for (const tid of terminalIds) {
    try {
      const children = await window.terminalAPI.getChildProcesses(tid);
      if (children && children.length > 0) {
        for (const child of children) {
          allJobs.push({ ...child, terminalId: tid });
        }
      }
    } catch (e) {
      // terminal may have exited
    }
  }

  render(allJobs);
}

function render(jobs) {
  const stateLabel = { R: 'Running', S: 'Sleeping', T: 'Stopped', Z: 'Zombie', D: 'Disk Wait', I: 'Idle' };

  modalEl.innerHTML = `
    <div class="jt-backdrop" data-close="true"></div>
    <div class="jt-panel">
      <div class="jt-header">
        <h3>Background Jobs</h3>
        <button class="jt-close" data-close="true">&times;</button>
      </div>
      <div class="jt-body">
        ${jobs.length === 0
          ? '<div class="jt-empty">No background processes found.</div>'
          : `<table class="jt-table">
              <thead>
                <tr>
                  <th>PID</th>
                  <th>Command</th>
                  <th>State</th>
                  <th>Terminal</th>
                </tr>
              </thead>
              <tbody>
                ${jobs.map((j) => `
                  <tr>
                    <td class="jt-pid">${j.pid}</td>
                    <td class="jt-cmd">${escapeHtml(j.command)}</td>
                    <td><span class="jt-state jt-state-${j.state}">${stateLabel[j.state] || j.state}</span></td>
                    <td class="jt-tid">${j.terminalId}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>`
        }
      </div>
    </div>
  `;

  modalEl.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', close);
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = {
  init,
  open,
  close,
  toggle,
};
