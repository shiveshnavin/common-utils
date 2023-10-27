git fetch origin 
git stash
git checkout main
git reset --hard origin/main
git stash pop
git add -A
git commit -m "update: $1"
git push origin main
cd ..
git add common-utils
git commit -m "Update submodule version"
git push origin HEAD
