#include <string>
#include <STEPControl_Controller.hxx>
#include <STEPControl_Reader.hxx>
#include <STEPControl_Writer.hxx>
#include <IGESControl_Controller.hxx>
#include <IGESControl_Reader.hxx>
#include <IGESControl_Writer.hxx>
#include <BRepCheck_Analyzer.hxx>
#include <IFSelect_ReturnStatus.hxx>
#include <Interface_Static.hxx>
#include <Message_ProgressRange.hxx>

// Exchange exact B-Rep through STEP so the optional IGES engine stays isolated
// from the application's kernel and can be terminated after each conversion.
class NiliCADIGES {
public:
  static bool Convert(const std::string& input, const std::string& output,
                      bool toIGES) {
    try {
      STEPControl_Controller::Init();
      IGESControl_Controller::Init();
      Message_ProgressRange progress;
      TopoDS_Shape shape;
      if (toIGES) {
        STEPControl_Reader reader;
        if (reader.ReadFile(input.c_str()) != IFSelect_RetDone ||
            !reader.TransferRoots(progress)) return false;
        shape = reader.OneShape();
      } else {
        IGESControl_Reader reader;
        if (reader.ReadFile(input.c_str()) != IFSelect_RetDone ||
            !reader.TransferRoots(progress)) return false;
        shape = reader.OneShape();
      }
      if (shape.IsNull() || !BRepCheck_Analyzer(shape).IsValid()) return false;
      if (toIGES) {
        IGESControl_Writer writer("MM", 1);
        if (!writer.AddShape(shape, progress)) return false;
        writer.ComputeModel();
        return writer.Write(output.c_str(), false);
      }
      Interface_Static::SetCVal("write.step.unit", "MM");
      STEPControl_Writer writer;
      if (writer.Transfer(shape, STEPControl_AsIs, true, progress) !=
          IFSelect_RetDone) return false;
      return writer.Write(output.c_str()) == IFSelect_RetDone;
    } catch (...) {
      return false;
    }
  }
};
