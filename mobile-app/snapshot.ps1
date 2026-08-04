git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --porcelain=v1
git log --oneline --decorate -n 10
git branch --contains HEAD
git diff 24ac94d..HEAD --check
git diff 24ac94d..HEAD -- mobile-app/package.json mobile-app/package-lock.json mobile-app/jest.config.js
npx tsc --noEmit
npx jest --listTests
npx jest --runInBand
