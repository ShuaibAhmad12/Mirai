import { NextResponse } from "next/server";
// import { z } from "zod";
import {  svcListCourses } from "@/lib/services/academic";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const data = await svcListCourses();

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }
}

// const CreateCourseSchema = z.object({
//   college_id: z.string().uuid(),
//   college_code: z.string().min(1),
//   course_identity: z.string().min(1),
//   name: z.string().min(1),
//   duration: z.number().int().min(1).nullable().optional(),
// });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('🔍 Creating course with data:', body);
    const supabase = await createClient();

    // Test connection to courses table
    const {  error: testError } = await supabase
      .from('courses')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Courses table test failed:', testError);
      return NextResponse.json(
        { error: `Database connection failed: ${testError.message}` },
        { status: 500 }
      );
    }

    // Insert the course
    const { data: course, error } = await supabase
      .from('courses')
      .insert([{
        college_id: body.college_id,
        college_code: body.college_code,
        course_identity: body.course_identity,
        name: body.name,
        duration: body.duration || null
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase insert error:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return NextResponse.json(
        { error: `Supabase error: ${error.message} (Code: ${error.code})` },
        { status: 500 }
      );
    }

    console.log('🎉 Course created successfully:', course);
    return NextResponse.json({ id: course.id }, { status: 201 });

  } catch (error) {
    console.error('💥 API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create course' },
      { status: 500 }
    );
  }
}