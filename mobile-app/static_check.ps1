git status --porcelain=v1
git rev-parse HEAD
git diff 24ac94d..HEAD --check
npm ci
npx tsc --noEmit
npx jest --listTests
npx jest --runInBand
git status --porcelain=v1
