git pull origin main
git add -A
git commit -m "update: $1"
git push origin HEAD
cd ..
git add common-utils
git commit -m "Update submodule version"
git push origin HEAD
