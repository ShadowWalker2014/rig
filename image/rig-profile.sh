# rig box environment, loaded by every login shell (rig runs commands with bash -l).
export DISPLAY="${DISPLAY:-:0}"
export PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
export PUPPETEER_SKIP_DOWNLOAD=true
if [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"; fi
