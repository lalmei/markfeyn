# PyPI publishing setup

The `publish.yml` workflow builds and checks a matching regular `vX.Y.Z`
GitHub release before uploading to PyPI. Draft releases, prereleases, PRs and
manual validation runs do not publish. Publishing a regular release is the
explicit upload trigger. The workflow must exist in the released commit.

Configure Trusted Publishing for the existing `markfeyn` project at:
https://pypi.org/manage/project/markfeyn/settings/publishing/

- Owner: `lalmei`
- Repository: `markfeyn`
- Workflow filename: `publish.yml`
- Environment: `pypi`

No API token or GitHub secret is required. Create the GitHub `pypi` environment
and configure a required reviewer before the first release run if a separate
approval gate is desired. Merely naming an environment in YAML does not add
reviewer protection. Only the publish job has OIDC permissions; it does not
check out or execute repository code.

Use a new, unused package version. PyPI already contains version 0.2.0; existing
release files cannot be overwritten. Do not move an existing tag to change
package metadata. Merge the classifier correction separately before preparing
the next version. The workflow builds from the release tag, not local files or
previously attached GitHub release assets. Review those assets for consistency.

A manual workflow dispatch validates its selected ref but never publishes.
After merging, run this validation before preparing the next release. This
workflow does not publish a GitHub release, alter tags, or skip existing files.
