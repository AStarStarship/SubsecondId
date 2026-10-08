#

## Contributing

### Github Workflows

The master branch is the latest version that when you download you get assumed to be working code. Milestones are numbered Milestone 1 as v0.1, Milestone 2 as v0.2, ..., Milestone 10 as v1.0, etc, but we may jump to Milestone 10 from any of Milestone 3 through 9. Each Milestone has a github issue attached to it that you may find a list of in Issue #10.

When you are working on any of the Issues, we use Cale's Mission Driven Development system. You will find an issue to work on, and you will run `git checkout -b Issue123`, where 123 is the issue ticket number. When you commit you must submit a Pull Request, at which time the Jest unit test will run, and all tests must pass in order for you to merge your changes to the master branch. You are not allowed to change the `package.json` version number, that may only done by an administrator.

To publish the NPM Package an administrator is required to chance the version number and create a changeset.

## License

Copyright [AStartup](https://astartup.net); license available at <https://github.com/AStarStart/SubsecondId>.
