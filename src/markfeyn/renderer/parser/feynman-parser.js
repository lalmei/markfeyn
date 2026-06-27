export class FeynmanParser {
  constructor(source, helpers) {
    this.source = String(source || "");
    this.helpers = helpers;
    this.diagram = helpers.createEmptyFeynmanDiagram();
  }

  parse() {
    this.source
      .split(/\r?\n/)
      .forEach((rawLine, index) => {
        this.parseLine(rawLine, index + 1);
      });

    return this.diagram;
  }

  parseLine(rawLine, lineNumber) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      return;
    }

    const parts = line.split(/\s+/);
    const command = parts[0];
    const rest = parts.slice(1);
    const helpers = this.helpers;

    if (command === "incoming") {
      this.diagram.incoming.push(...rest);
      return;
    }

    if (command === "outgoing") {
      this.diagram.outgoing.push(...rest);
      return;
    }

    if (command === "layout") {
      helpers.setDiagramOption(this.diagram, "layout", rest.join(" "), lineNumber);
      return;
    }

    if (command === "orientation" || command === "orient") {
      helpers.setDiagramOption(this.diagram, "orientation", rest.join(" "), lineNumber);
      return;
    }

    if (command === "tikz") {
      helpers.parseExplicitTikzOrientationCommand(rest, this.diagram, lineNumber);
      return;
    }

    if (helpers.isTikzOrientationCommand(command)) {
      helpers.parseTikzOrientationCommand(command, rest, this.diagram, lineNumber, { deprecated: true });
      return;
    }

    if (command === "align" || command === "alignment") {
      helpers.parseAlignmentCommand(rest, this.diagram, lineNumber);
      return;
    }

    if (command === "size") {
      helpers.setDiagramOption(this.diagram, "size", rest[0], lineNumber);
      return;
    }

    if (command === "options" || command === "option") {
      helpers.parseDiagramOptions(rest, this.diagram, lineNumber);
      return;
    }

    if (command === "position" || command === "at") {
      helpers.parseManualPosition(rest, this.diagram, lineNumber);
      return;
    }

    if (command === "label") {
      helpers.parseLabels(line.slice(command.length).trim(), this.diagram.labels, this.diagram.errors, lineNumber);
      return;
    }

    if (command === "brace") {
      helpers.parseBrace(line.slice(command.length).trim(), this.diagram, lineNumber);
      return;
    }

    if (command === "vertex" || command === "vertices") {
      helpers.parseVertices(line.slice(command.length).trim(), this.diagram.vertices, this.diagram.errors, lineNumber);
      return;
    }

    const edgeCommand = helpers.matchEdgeCommand(parts);

    if (edgeCommand) {
      helpers.parseEdges(
        line.slice(edgeCommand.words.join(" ").length).trim(),
        edgeCommand.name,
        edgeCommand.definition,
        this.diagram,
        lineNumber
      );
      return;
    }

    this.diagram.errors.push(`Line ${lineNumber}: unknown command "${command}"`);
  }
}
