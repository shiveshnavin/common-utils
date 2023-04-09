git commit -m "$1"
git push origin HEAD
cd ..
git add common-utils
git commit -m "Update submodule version"
git push origin HEAD
